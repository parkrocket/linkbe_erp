// 견적·계약서 입력 검사 — 정해진 값은 3-2 constraints 기준, 칸 길이는 migrations/2026-11-05-work-contract.sql 기준
const { isRealDate } = require('./expenseValidation');

const MAX_AMOUNT = 2000000000;
const ITEM_KINDS = ['normal', 'discount'];
const DOC_KINDS = ['estimate', 'contract'];

const fail = error => ({ ok: false, error });
const isInt = n => Number.isInteger(n);
const isMoney = n => isInt(n) && n >= -MAX_AMOUNT && n <= MAX_AMOUNT;
const isId = n => isInt(n) && n > 0;
const isBool = b => typeof b === 'boolean';
const isNil = v => v === undefined || v === null;

// 글 칸: 없으면 '', 문자열이 아니거나 max 초과면 null(오류)
const str = (v, max, { trim = true } = {}) => {
    if (isNil(v)) return '';
    if (typeof v !== 'string') return null;
    const s = trim ? v.trim() : v;
    return s.length > max ? null : s;
};
// 날짜 칸: 없거나 빈 값이면 null, 틀리면 undefined
const date = v => (isNil(v) || v === '' ? null : isRealDate(v) ? v : undefined);
// 링크: 빈 값 또는 http(s)만
const link = v => {
    const s = str(v, 500);
    return s === null || (s !== '' && !/^https?:\/\//i.test(s)) ? null : s;
};

// 품목·품목 문구 공통 칸 (kind 기본 normal, 음수 단가도 허용 — 예전 데이터)
const parseItem = it => {
    if (!it || typeof it !== 'object') return null;
    const content = str(it.content, 255);
    const groupName = str(it.groupName, 100);
    const note = str(it.note, 255);
    const unitPrice = isNil(it.unitPrice) ? 0 : it.unitPrice;
    const qty = isNil(it.qty) ? 0 : it.qty;
    const period = isNil(it.period) ? 0 : it.period;
    const kind = isNil(it.kind) ? 'normal' : it.kind;
    if (!content || groupName === null || note === null) return null;
    if (!isMoney(unitPrice) || !isInt(qty) || qty < 0 || qty > 100000 || !isInt(period) || period < 0 || period > 10000) return null;
    if (!ITEM_KINDS.includes(kind)) return null;
    return { groupName, content, unitPrice, qty, period, note, kind };
};

const parseManager = m => {
    if (!m || typeof m !== 'object') return null;
    const name = str(m.name, 50);
    const phone = str(m.phone, 50);
    const email = str(m.email, 150);
    const memo = str(m.memo, 255);
    return [name, phone, email, memo].includes(null) ? null : { name, phone, email, memo };
};

// [키, 최대 길이, trim 여부] — 글 칸
const TEXT_FIELDS = [
    ['docNo', 30], ['bizNo', 30], ['ceoName', 50], ['companyEmail', 150], ['projectName', 200], ['workPeriod', 100],
    ['memo', 10000, false], ['opsServer1', 10000, false], ['opsServer2', 10000, false], ['opsSpend', 10000, false], ['opsSite', 500],
];
const MONEY_FIELDS = ['total', 'deposit', 'balance', 'paidAmount'];
const FLAG_FIELDS = ['isHold', 'isCancelled', 'isPaidFull', 'invoiceIssued'];

const validateContract = input => {
    const b = input || {};
    const value = {};
    const companyName = str(b.companyName, 100);
    if (!companyName) return fail('Invalid companyName');
    value.companyName = companyName;
    for (const [key, max, trim] of TEXT_FIELDS) {
        const s = str(b[key], max, { trim });
        if (s === null) return fail(`Invalid ${key}`);
        value[key] = s;
    }
    for (const key of ['link1', 'link2']) {
        const s = link(b[key]);
        if (s === null) return fail(`Invalid ${key}`);
        value[key] = s;
    }
    for (const key of ['contractDate', 'deliveryDate']) {
        const d = date(b[key]);
        if (d === undefined) return fail(`Invalid ${key}`);
        value[key] = d;
    }
    for (const key of MONEY_FIELDS) {
        const n = isNil(b[key]) ? 0 : b[key];
        if (!isMoney(n)) return fail(`Invalid ${key}`);
        value[key] = n;
    }
    for (const key of FLAG_FIELDS) {
        const f = isNil(b[key]) ? false : b[key];
        if (!isBool(f)) return fail(`Invalid ${key}`);
        value[key] = f;
    }
    if (isNil(b.categoryId)) value.categoryId = null;
    else if (isId(b.categoryId)) value.categoryId = b.categoryId;
    else return fail('Invalid categoryId');

    const items = isNil(b.items) ? [] : b.items;
    if (!Array.isArray(items) || items.length > 200) return fail('Invalid items');
    value.items = [];
    for (const it of items) {
        const p = parseItem(it);
        if (!p) return fail('Invalid item');
        value.items.push(p);
    }
    const managers = isNil(b.managers) ? [] : b.managers;
    if (!Array.isArray(managers) || managers.length > 20) return fail('Invalid managers');
    value.managers = [];
    for (const m of managers) {
        const p = parseManager(m);
        if (!p) return fail('Invalid manager');
        value.managers.push(p);
    }
    if (b.updatedAt !== undefined) {
        if (typeof b.updatedAt !== 'string') return fail('Invalid updatedAt');
        value.updatedAt = b.updatedAt;
    }
    return { ok: true, value };
};

const validateCategory = input => {
    const name = str((input || {}).name, 50);
    return name ? { ok: true, value: { name } } : fail('Invalid name');
};

const validateItemTemplate = input => {
    const b = input || {};
    if (!isId(b.categoryId)) return fail('Invalid categoryId');
    const item = parseItem(b);
    return item ? { ok: true, value: { categoryId: b.categoryId, ...item } } : fail('Invalid item');
};

const validateDocTemplate = input => {
    const b = input || {};
    if (!DOC_KINDS.includes(b.kind)) return fail('Invalid kind');
    const name = str(b.name, 100);
    if (!name) return fail('Invalid name');
    if (!isNil(b.categoryId) && !isId(b.categoryId)) return fail('Invalid categoryId');
    // express json 한도(1MB) 안에서 css 등 나머지 칸 여유를 두려고 900,000자까지만 허용
    const bodyHtml = str(b.bodyHtml, 900000, { trim: false });
    if (bodyHtml === null) return fail('Invalid bodyHtml');
    const css = str(b.css, 200000, { trim: false });
    if (css === null) return fail('Invalid css');
    const isDefault = isNil(b.isDefault) ? false : b.isDefault;
    if (!isBool(isDefault)) return fail('Invalid isDefault');
    const value = { kind: b.kind, name, categoryId: isNil(b.categoryId) ? null : b.categoryId, bodyHtml, css, isDefault };
    if (b.updatedAt !== undefined) {
        if (typeof b.updatedAt !== 'string') return fail('Invalid updatedAt');
        value.updatedAt = b.updatedAt;
    }
    return { ok: true, value };
};

module.exports = { validateContract, validateCategory, validateItemTemplate, validateDocTemplate };
