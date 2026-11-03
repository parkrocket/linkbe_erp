const Expense = require('../models/expenseModel');
const Admin = require('../models/adminModel');
const { EXPENSE_STATUSES, validateExpense, parseMonth } = require('../utils/expenseValidation');
const { escapeSlack } = require('../utils/slackEscape');
const slackDm = require('../utils/slackDm'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)

// 경비 API — requireAuth 뒤. 모든 조회·변경은 req.userCpId 범위, 권한 판단은 req.expenseApprover

const fail = (res, code, error) => res.status(code).json({ error });

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('work expense api error:', error.message);
        if (!res.headersSent) fail(res, 500, 'Database query error');
    }
};

// 응답에는 이메일·writer_no를 내보내지 않음
const toItem = (row, me) => ({
    id: row.id,
    spentOn: row.spent_on,
    category: row.category,
    amount: row.amount,
    title: row.title,
    status: row.status,
    writerName: row.writer_name,
    isMine: row.writer_no === me.mb_no,
    createdAt: row.created_at,
});

const won = amount => `${Number(amount).toLocaleString('ko-KR')}원`;

const STATUS_PHRASE = { approved: '승인됐어요', confirmed: '승인완료됐어요', paid: '입금완료됐어요', pending: '대기로 돌아갔어요' };

// DM은 응답을 바꾸면 안 되므로 실패는 삼킴
const dm = async (email, text) => {
    try {
        await slackDm.sendDm(email, text);
    } catch (error) {
        console.warn('Slack DM 오류:', error.message);
    }
};

// 요청자(직원 행). 없으면 401 응답 후 null
async function loadMe(req, res) {
    const me = await Admin.findByUserId(req.userCpId, req.userId);
    if (!me) fail(res, 401, 'Unauthorized');
    return me || null;
}

// 형식이 틀린 id는 null (404 처리)
const parseId = value => (/^[1-9]\d{0,14}$/.test(value) ? Number(value) : null);

// 경비 조회 + 열람 권한 검사. 없음·다른 회사·남의 것(권한 없음)은 모두 404
async function loadVisible(req, res, me) {
    const id = parseId(req.params.id);
    const row = id && (await Expense.findById(req.userCpId, id));
    if (!row || (!req.expenseApprover && row.writer_no !== me.mb_no)) return fail(res, 404, 'Expense not found') && null;
    return row;
}

exports.list = handle(async (req, res) => {
    const month = parseMonth(req.query.month);
    if (!month) return fail(res, 400, 'Invalid month');
    const { status } = req.query;
    if (status && !EXPENSE_STATUSES.includes(status)) return fail(res, 400, 'Invalid status');
    const me = await loadMe(req, res);
    if (!me) return;
    const writerNo = req.expenseApprover ? null : me.mb_no;
    const [rows, summary] = await Promise.all([Expense.list(req.userCpId, { month, status: status || null, writerNo }), Expense.summary(req.userCpId, { month, writerNo })]);
    res.json({ month, expenses: rows.map(r => toItem(r, me)), summary, canApprove: !!req.expenseApprover });
});

exports.detail = handle(async (req, res) => {
    const me = await loadMe(req, res);
    if (!me) return;
    const row = await loadVisible(req, res, me);
    if (!row) return;
    res.json({ expense: { ...toItem(row, me), body: row.body, history: row.history } });
});

exports.create = handle(async (req, res) => {
    const checked = validateExpense(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const me = await loadMe(req, res);
    if (!me) return;
    const id = await Expense.create(req.userCpId, { writerNo: me.mb_no, writerName: me.user_name, ...checked.value });
    res.json({ id });

    // 승인 권한자 전원에게 DM (기안자 본인 제외). 실패해도 이미 응답함
    const text = `새 경비 기안: ${escapeSlack(checked.value.title)} · ${won(checked.value.amount)} · ${escapeSlack(me.user_name)}`;
    const emails = (await Expense.approverEmails(req.userCpId).catch(() => [])).filter(e => e !== req.userId);
    await Promise.allSettled(emails.map(e => dm(e, text)));
});

exports.update = handle(async (req, res) => {
    const checked = validateExpense(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const me = await loadMe(req, res);
    if (!me) return;
    const row = await loadVisible(req, res, me);
    if (!row) return;
    if (row.writer_no !== me.mb_no) return fail(res, 403, 'Not yours');
    if (row.status !== 'pending') return fail(res, 409, 'Not pending');
    if (!(await Expense.updateOwnPending(req.userCpId, row.id, me.mb_no, checked.value))) return fail(res, 409, 'Not pending');
    res.json({ ok: true });
});

exports.remove = handle(async (req, res) => {
    const me = await loadMe(req, res);
    if (!me) return;
    const row = await loadVisible(req, res, me);
    if (!row) return;
    if (row.writer_no !== me.mb_no) return fail(res, 403, 'Not yours');
    if (row.status !== 'pending') return fail(res, 409, 'Not pending');
    if (!(await Expense.removeOwnPending(req.userCpId, row.id, me.mb_no))) return fail(res, 409, 'Not pending');
    res.json({ ok: true });
});

exports.changeStatus = handle(async (req, res) => {
    if (!req.expenseApprover) return fail(res, 403, 'Approver only');
    const { from, to } = req.body || {};
    // from === to 는 의미 없는 이력만 남으므로 막음
    if (!EXPENSE_STATUSES.includes(from) || !EXPENSE_STATUSES.includes(to) || from === to) return fail(res, 400, 'Invalid status');
    const me = await loadMe(req, res);
    if (!me) return;
    const row = await loadVisible(req, res, me);
    if (!row) return;
    if (!(await Expense.transition(req.userCpId, row.id, from, to, me.user_name))) return fail(res, 409, 'Status changed');
    res.json({ ok: true });

    // 기안자에게 DM (본인이 바꿨거나 이메일이 없으면 생략)
    if (row.writer_email && row.writer_no !== me.mb_no) {
        await dm(row.writer_email, `경비 '${escapeSlack(row.title)}'이 ${STATUS_PHRASE[to]} (${won(row.amount)})`);
    }
});

exports.summary = handle(async (req, res) => {
    res.json({ pendingExpenses: req.expenseApprover ? await Expense.pendingCount(req.userCpId) : 0 });
});
