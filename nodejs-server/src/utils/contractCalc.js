// 견적·계약서 금액 계산 — 화면 hibye-web lib/contract.ts와 같은 규칙·같은 테스트 값
// 부가세: 0 쪽으로 내림 (음수는 -vat(-n)). `|| 0`은 -0을 0으로
const vat = n => (n >= 0 ? Math.floor(n * 0.1) : -Math.floor(-n * 0.1) || 0);

// 품목 금액: 수량·기간 0은 1로 셈(예전 규칙)
const itemAmount = ({ unitPrice, qty, period }) => unitPrice * (qty || 1) * (period || 1);

const itemsTotal = items => items.reduce((sum, item) => sum + itemAmount(item), 0);

// 미수: 보류·취소는 0, 초과 입금은 음수 (RECEIVABLE_SQL과 같은 값)
const receivable = ({ total, paidAmount, isHold, isCancelled }) =>
    isHold || isCancelled ? 0 : total + vat(total) - paidAmount;

// 상태 우선순위: 취소 → 보류 → 완납 → 미수 → 진행
const contractStatus = c => {
    if (c.isCancelled) return 'cancelled';
    if (c.isHold) return 'hold';
    if (c.isPaidFull) return 'paid';
    return receivable(c) > 0 ? 'unpaid' : 'active';
};

// 목록 SQL용 같은 식 (별칭 없는 테이블 칸)
const RECEIVABLE_SQL =
    'CASE WHEN is_hold = 1 OR is_cancelled = 1 THEN 0 ELSE total + IF(total >= 0, FLOOR(total * 0.1), -FLOOR(-total * 0.1)) - paid_amount END';

module.exports = { vat, itemAmount, itemsTotal, receivable, contractStatus, RECEIVABLE_SQL };
