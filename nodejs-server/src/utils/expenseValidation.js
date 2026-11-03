// 경비 입력 검사 — 정해진 값은 3차 업무 도구 설계(constraints) 기준
const EXPENSE_CATEGORIES = ['server', 'supplies', 'welfare', 'rent', 'tax', 'etc'];
const EXPENSE_STATUSES = ['pending', 'approved', 'confirmed', 'paid'];
const STATUS_NAME = { pending: '대기', approved: '승인', confirmed: '승인완료', paid: '입금완료' };
const MAX_AMOUNT = 2000000000;

// 실제 있는 날짜인지: Date.UTC로 만든 뒤 다시 문자열로 바꿔 같은지 비교
const isRealDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
};

const fail = error => ({ ok: false, error });

const validateExpense = input => {
    const { spentOn, category, amount, title, body } = input || {};
    if (!isRealDate(spentOn)) return fail('Invalid date');
    if (!EXPENSE_CATEGORIES.includes(category)) return fail('Invalid category');
    if (!Number.isInteger(amount) || amount < 0 || amount > MAX_AMOUNT) return fail('Invalid amount');
    const t = typeof title === 'string' ? title.trim() : '';
    if (t.length < 1 || t.length > 100) return fail('Invalid title');
    const b = body === undefined || body === null ? '' : body;
    if (typeof b !== 'string' || b.length > 5000) return fail('Invalid body');
    return { ok: true, value: { spentOn, category, amount, title: t, body: b } };
};

// 비었으면 KST 이번 달, 형식·범위가 틀리면 null
const parseMonth = (value, now = new Date()) => {
    if (value === undefined || value === null || value === '') return new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 7);
    return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
};

module.exports = { EXPENSE_CATEGORIES, EXPENSE_STATUSES, STATUS_NAME, validateExpense, parseMonth, isRealDate };
