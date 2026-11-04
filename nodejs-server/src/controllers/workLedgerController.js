const { Ledger, Account } = require('../models/ledgerModel');
const Admin = require('../models/adminModel');
const { validateLedger, validateAccount, SIDES } = require('../utils/ledgerValidation');

// 매출/매입 장부·계정과목 API — requireAuth·requireWorkDoc 뒤. 모든 조회·변경은 req.userCpId 범위

const MAX_SIZE = 100;

const fail = (res, code, error) => res.status(code).json({ error });
const notFound = res => fail(res, 404, 'Not found');

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('work ledger api error:', error.message);
        if (!res.headersSent) fail(res, 500, 'Database query error');
    }
};

// 형식이 틀린 id는 null (404 처리)
const parseId = value => (/^[1-9]\d{0,14}$/.test(String(value)) ? Number(value) : null);

// 점검에서 시각을 주입하기 위한 자리 (기본 year = KST 올해)
exports.now = () => Date.now();
const kstYear = () => new Date(exports.now() + 9 * 3600 * 1000).getUTCFullYear();

// 쿼리 정수: 빈 값 = 기본값, 정수가 아니거나 범위 밖이면 null (호출한 쪽이 400 처리)
const intQuery = (v, def, min, max) => {
    if (v === undefined || v === '') return def;
    if (typeof v !== 'string' || !/^-?\d{1,15}$/.test(v)) return null;
    const n = Number(v);
    return n >= min && n <= max ? n : null;
};

const toRow = r => ({
    id: r.id,
    side: r.side,
    entryDate: r.entry_date,
    accountId: r.account_id,
    title: r.title,
    memo: r.memo,
    supply: r.supply,
    tax: r.tax,
    total: r.total,
    createdAt: r.created_at,
});

const toDetail = r => ({ ...toRow(r), updatedAt: r.updated_at, updatedAtKst: r.updated_at_kst });

// 쿼리 검사 → { filter, q, page, size } | { error }
const parseQuery = query => {
    const year = intQuery(query.year, kstYear(), 2000, 2100);
    if (year === null) return { error: 'Invalid year' };
    const month = intQuery(query.month, null, 1, 12);
    if (month === null && query.month !== undefined && query.month !== '') return { error: 'Invalid month' }; // 빈 값만 월 없음
    const side = query.side === undefined || query.side === '' ? null : query.side;
    if (side && !SIDES.includes(side)) return { error: 'Invalid side' };
    let accountId = null;
    if (query.accountId !== undefined && query.accountId !== '') {
        accountId = parseId(query.accountId);
        if (!accountId) return { error: 'Invalid accountId' };
    }
    const page = intQuery(query.page, 1, 1, 1000000);
    if (page === null) return { error: 'Invalid page' };
    // size는 최대 100 — 넘으면 100으로 줄임(숫자가 아니거나 1 미만이면 400)
    let size = intQuery(query.size, 20, 1, 1000000);
    if (size === null) return { error: 'Invalid size' };
    size = Math.min(size, MAX_SIZE);
    const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
    return { filter: { year, month, side, accountId }, q, page, size };
};

exports.list = handle(async (req, res) => {
    const { filter, q, page, size, error } = parseQuery(req.query);
    if (error) return fail(res, 400, error);
    const { rows, total } = await Ledger.list(req.userCpId, { ...filter, q, page, size });
    const summary = await Ledger.summary(req.userCpId, filter);
    res.json({ entries: rows.map(toRow), total, page, size, summary });
});

exports.detail = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const row = id && (await Ledger.findById(req.userCpId, id));
    if (!row) return notFound(res);
    res.json({ entry: toDetail(row) });
});

exports.create = handle(async (req, res) => {
    const checked = validateLedger(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const me = await Admin.findByUserId(req.userCpId, req.userId);
    if (!me) return fail(res, 401, 'Unauthorized');
    const id = await Ledger.create(req.userCpId, checked.value, me.mb_no);
    if (!id) return fail(res, 400, 'Invalid accountId'); // 묶음·다른 구분·다른 회사 계정
    res.json({ id });
});

exports.update = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const checked = validateLedger(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const result = await Ledger.update(req.userCpId, id, checked.value);
    if (result === 'missing') return notFound(res);
    if (result === 'changed') return fail(res, 409, 'Ledger changed');
    if (result === 'invalid') return fail(res, 400, 'Invalid accountId');
    res.json({ ok: true });
});

exports.remove = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id || !(await Ledger.remove(req.userCpId, id))) return notFound(res);
    res.json({ ok: true });
});

// ---- 계정과목 ----

exports.accounts = handle(async (req, res) => {
    const rows = await Account.list(req.userCpId);
    res.json({ accounts: rows.map(a => ({ id: a.id, side: a.side, code: a.code, label: a.label, name: a.name, sort: a.sort, used: a.used, isGroup: a.isGroup })) });
});

exports.createAccount = handle(async (req, res) => {
    const checked = validateAccount(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const result = await Account.create(req.userCpId, checked.value);
    if (result === 'duplicate') return fail(res, 409, 'Duplicate code');
    if (result === 'invalid') return fail(res, 400, 'Invalid code');
    res.json({ id: result });
});

exports.updateAccount = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const checked = validateAccount(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const result = await Account.update(req.userCpId, id, checked.value);
    if (result === 'missing') return notFound(res);
    if (result === 'duplicate') return fail(res, 409, 'Duplicate code');
    if (result === 'invalid') return fail(res, 400, 'Invalid code');
    res.json({ ok: true });
});

exports.removeAccount = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const result = await Account.remove(req.userCpId, id);
    if (result === 'missing') return notFound(res);
    if (result === 'used') return fail(res, 409, 'In use');
    res.json({ ok: true });
});
