// 관리자 연차·휴가 조정 요청 검증 (POST /api/admin/balances)
// 바디는 신뢰하지 않음 — 문자열 숫자·NaN·Infinity도 거부 (DB에 이상한 값이 들어가지 않게)

const MAX_BALANCE = 365;
const MAX_CHANGES = 200;
const MAX_REASON = 200;

const inRange = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_BALANCE;
const isStip = v => inRange(v) && Number.isInteger(v * 2); // 연차는 반차 때문에 0.5 단위
const isVaca = v => inRange(v) && Number.isInteger(v);
// 화면을 열 때 값 — 잔여 컬럼이 NULL인 직원도 있어 null 허용
const orNull = check => v => v === null || check(v);

exports.validateAdjust = body => {
    const { reason, changes } = body || {};
    const trimmed = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmed || trimmed.length > MAX_REASON) return { error: 'Invalid reason' };

    if (!Array.isArray(changes) || changes.length === 0 || changes.length > MAX_CHANGES) return { error: 'Invalid changes' };
    if (!changes.every(c => c && Number.isInteger(c.mbNo) && c.mbNo > 0)) return { error: 'Invalid changes' };
    if (new Set(changes.map(c => c.mbNo)).size !== changes.length) return { error: 'Invalid changes' };

    const valid = changes.every(
        c => isStip(c.stip) && isVaca(c.vaca) && orNull(isStip)(c.expectedStip) && orNull(isVaca)(c.expectedVaca),
    );
    if (!valid) return { error: 'Invalid balance' };

    return {
        reason: trimmed,
        changes: changes.map(({ mbNo, stip, vaca, expectedStip, expectedVaca }) => ({ mbNo, stip, vaca, expectedStip, expectedVaca })),
    };
};
