const Contract = require('../models/contractModel');
const DocSetting = require('../models/docSettingModel');
const Admin = require('../models/adminModel');
const { validateContract } = require('../utils/contractValidation');
const { isRealDate } = require('../utils/expenseValidation');
const { itemAmount, itemsTotal, contractStatus } = require('../utils/contractCalc');

// 견적·계약서 API — requireAuth·requireWorkDoc 뒤. 모든 조회·변경은 req.userCpId 범위

const STATUSES = ['active', 'unpaid', 'paid', 'hold', 'cancelled'];
const MAX_AMOUNT = 2000000000;
const MAX_SIZE = 100;

const fail = (res, code, error) => res.status(code).json({ error });
const notFound = res => fail(res, 404, 'Not found');

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('work contract api error:', error.message);
        if (!res.headersSent) fail(res, 500, 'Database query error');
    }
};

// 형식이 틀린 id는 null (404 처리)
const parseId = value => (/^[1-9]\d{0,14}$/.test(String(value)) ? Number(value) : null);

// 목록 행: 상태는 contractStatus로 (SQL 필터와 같은 우선순위)
const toRow = r => ({
    id: r.id,
    docNo: r.doc_no,
    categoryId: r.category_id,
    categoryName: r.category_name,
    companyName: r.company_name,
    projectName: r.project_name,
    contractDate: r.contract_date,
    deliveryDate: r.delivery_date,
    total: r.total,
    paidAmount: r.paid_amount,
    receivable: Number(r.receivable),
    status: contractStatus({ isCancelled: !!r.is_cancelled, isHold: !!r.is_hold, isPaidFull: !!r.is_paid_full, total: r.total, paidAmount: r.paid_amount }),
    invoiceIssued: !!r.invoice_issued,
    createdAt: r.created_at,
});

const toDetail = (r, categoryName) => ({
    id: r.id,
    docNo: r.doc_no,
    categoryId: r.category_id,
    categoryName,
    companyName: r.company_name,
    bizNo: r.biz_no,
    ceoName: r.ceo_name,
    companyEmail: r.company_email,
    projectName: r.project_name,
    contractDate: r.contract_date,
    deliveryDate: r.delivery_date,
    workPeriod: r.work_period,
    memo: r.memo,
    link1: r.link1,
    link2: r.link2,
    total: r.total,
    deposit: r.deposit,
    balance: r.balance,
    paidAmount: r.paid_amount,
    isHold: !!r.is_hold,
    isCancelled: !!r.is_cancelled,
    isPaidFull: !!r.is_paid_full,
    invoiceIssued: !!r.invoice_issued,
    opsServer1: r.ops_server1,
    opsServer2: r.ops_server2,
    opsSpend: r.ops_spend,
    opsSite: r.ops_site,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items: r.items.map(i => ({
        id: i.id, sort: i.sort, groupName: i.group_name, content: i.content, unitPrice: i.unit_price, qty: i.qty, period: i.period, note: i.note, kind: i.kind,
    })),
    managers: r.managers.map(m => ({ id: m.id, sort: m.sort, name: m.name, phone: m.phone, email: m.email, memo: m.memo })),
});

// 범위 안의 정수 쿼리 값 (잘못되면 기본값에서 가까운 쪽으로)
const clampInt = (v, def, min, max) => {
    const n = Number(v);
    return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : def;
};

exports.list = handle(async (req, res) => {
    const { status, from, to } = req.query;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    let categoryId = null;
    if (req.query.categoryId) {
        categoryId = parseId(req.query.categoryId);
        if (!categoryId) return fail(res, 400, 'Invalid categoryId');
    }
    if (status && !STATUSES.includes(status)) return fail(res, 400, 'Invalid status');
    for (const d of [from, to]) if (d && !isRealDate(d)) return fail(res, 400, 'Invalid date');
    const page = clampInt(req.query.page, 1, 1, 1000000);
    const size = clampInt(req.query.size, 20, 1, MAX_SIZE);
    const { rows, total } = await Contract.list(req.userCpId, { categoryId, status: status || undefined, from: from || undefined, to: to || undefined, q, page, size });
    // 업체명 검색일 때만 그 업체의 입금·미수 합계
    const companyTotals = q ? await Contract.companyTotals(req.userCpId, q) : null;
    res.json({ contracts: rows.map(toRow), total, page, size, companyTotals });
});

exports.companies = handle(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (!q) return res.json({ companies: [] });
    const rows = await Contract.companies(req.userCpId, q);
    res.json({
        companies: rows.map(r => ({
            companyName: r.company_name, bizNo: r.biz_no, ceoName: r.ceo_name, companyEmail: r.company_email,
            managerName: r.manager_name, managerPhone: r.manager_phone, managerEmail: r.manager_email,
        })),
    });
});

exports.detail = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const row = id && (await Contract.findById(req.userCpId, id));
    if (!row) return notFound(res);
    const category = row.category_id ? (await DocSetting.listCategories(req.userCpId)).find(c => c.id === row.category_id) : null;
    res.json({ contract: toDetail(row, category ? category.name : null) });
});

// 검사 + 금액 범위 + 빈 담당자 행 제거 → { value } | { error }
const prepare = body => {
    const checked = validateContract(body);
    if (!checked.ok) return { error: checked.error };
    const value = checked.value;
    // 품목 금액(단가×수량×기간)·합계가 범위를 넘으면 거절
    if (value.items.some(i => Math.abs(itemAmount(i)) > MAX_AMOUNT) || Math.abs(itemsTotal(value.items)) > MAX_AMOUNT) return { error: 'Invalid items' };
    value.managers = value.managers.filter(m => m.name || m.phone || m.email || m.memo);
    return { value };
};

exports.create = handle(async (req, res) => {
    const { value, error } = prepare(req.body);
    if (error) return fail(res, 400, error);
    const me = await Admin.findByUserId(req.userCpId, req.userId);
    if (!me) return fail(res, 401, 'Unauthorized');
    const id = await Contract.create(req.userCpId, value, me.mb_no);
    if (!id) return fail(res, 400, 'Invalid categoryId'); // 다른 회사 분류
    res.json({ id });
});

exports.update = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const { value, error } = prepare(req.body);
    if (error) return fail(res, 400, error);
    const result = await Contract.update(req.userCpId, id, value);
    if (result === 'missing') return notFound(res);
    if (result === 'changed') return fail(res, 409, 'Contract changed');
    if (result === 'invalid') return fail(res, 400, 'Invalid categoryId');
    res.json({ ok: true });
});

exports.remove = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id || !(await Contract.remove(req.userCpId, id))) return notFound(res);
    res.json({ ok: true });
});
