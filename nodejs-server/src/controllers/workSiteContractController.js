const SiteContract = require('../models/siteContractModel');
const { str, date } = require('../utils/contractValidation');

// 계약 관리 API — requireAuth·requireWorkDoc 뒤. 모든 조회·변경은 req.userCpId 범위

const STATUSES = ['run', 'stop'];

const fail = (res, code, error) => res.status(code).json({ error });
const notFound = res => fail(res, 404, 'Not found');

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('work site contract api error:', error.message);
        if (!res.headersSent) fail(res, 500, 'Database query error');
    }
};

// 형식이 틀린 id는 null (404 처리)
const parseId = value => (/^[1-9]\d{0,14}$/.test(String(value)) ? Number(value) : null);

// 입력 검사 — 칸 길이는 migrations/2026-11-13-work-site-contract.sql 기준. 반환 { value } | { error }
const validate = input => {
    const b = input || {};
    const companyName = str(b.companyName, 200);
    if (!companyName) return { error: 'Invalid companyName' };
    const code = str(b.code, 100);
    if (code === null) return { error: 'Invalid code' };
    const siteUrl = str(b.siteUrl, 255);
    if (siteUrl === null) return { error: 'Invalid siteUrl' };
    const email = str(b.email, 200);
    if (email === null) return { error: 'Invalid email' };
    const memo = str(b.memo, 5000, { trim: false });
    if (memo === null) return { error: 'Invalid memo' };
    // 날짜는 비워도 됨(null), 틀린 날짜는 오류. 둘 다 있으면 종료일이 시작일보다 앞설 수 없음
    const startDate = date(b.startDate);
    if (startDate === undefined) return { error: 'Invalid startDate' };
    const endDate = date(b.endDate);
    if (endDate === undefined || (startDate && endDate && endDate < startDate)) return { error: 'Invalid endDate' };
    if (!STATUSES.includes(b.status)) return { error: 'Invalid status' };
    if (b.updatedAt !== undefined && typeof b.updatedAt !== 'string') return { error: 'Invalid updatedAt' };
    return { value: { code, companyName, siteUrl, startDate, endDate, status: b.status, email, memo, updatedAt: b.updatedAt } };
};
exports.validate = validate;

const toRow = r => ({
    id: r.id,
    code: r.code,
    companyName: r.company_name,
    siteUrl: r.site_url,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status,
    email: r.email,
    memo: r.memo,
    updatedAt: r.updated_at, // 동시 수정 검사용 — 저장 때 그대로 되돌려 보냄
});

exports.list = handle(async (req, res) => {
    res.json({ contracts: (await SiteContract.list(req.userCpId)).map(toRow) });
});

exports.create = handle(async (req, res) => {
    const { value, error } = validate(req.body);
    if (error) return fail(res, 400, error);
    res.json({ id: await SiteContract.create(req.userCpId, value) });
});

exports.update = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const { value, error } = validate(req.body);
    if (error) return fail(res, 400, error);
    const result = await SiteContract.update(req.userCpId, id, value);
    if (result === 'missing') return notFound(res);
    if (result === 'changed') return fail(res, 409, 'Site contract changed');
    res.json({ ok: true });
});

exports.remove = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id || !(await SiteContract.remove(req.userCpId, id))) return notFound(res);
    res.json({ ok: true });
});
