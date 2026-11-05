// 업무(경비 등) 공통 — 이름표·입력 검사·권한 판단 (서버 workExpenseController 응답 모양)
import { digitsOnly } from './shop';
import type { User } from './types';

export const EXPENSE_CATEGORY_LABEL = {
    server: '서버/도메인',
    supplies: '비품/소모품',
    welfare: '복리후생',
    rent: '임차/관리',
    tax: '세금/공과금',
    etc: '기타',
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORY_LABEL;

export const EXPENSE_STATUS_LABEL = {
    pending: '대기',
    approved: '승인',
    confirmed: '승인완료',
    paid: '입금완료',
} as const;
export type ExpenseStatus = keyof typeof EXPENSE_STATUS_LABEL;

// 기안 내용 기본값 — 화면이 미리 채움
export const EXPENSE_BODY_TEMPLATE = '내역 : \n은행 / 계좌 : \n입금액 : \n\n카드 뒷 4자리 : \n결제액 : ';

// 내용의 '숫자(콤마 가능) + 원'을 모두 더함 — 예전 경비 화면(formp) 스크립트와 같은 규칙. 없으면 0
// (사용자 결정 11-05: 예전과 똑같이 — 합계가 0이면 금액 칸을 비움)
export function sumWonInText(text: string): number {
    return [...text.matchAll(/(\d[\d,]*)\s*원/g)].reduce((total, m) => total + Number(m[1].replace(/,/g, '')), 0);
}

export type ExpenseItem = {
    id: number;
    spentOn: string; // YYYY-MM-DD
    category: ExpenseCategory;
    amount: number;
    title: string;
    status: ExpenseStatus;
    writerName: string;
    isMine: boolean;
    createdAt: string;
};
export type ExpenseDetail = ExpenseItem & { body: string; history: string };

// 관리자는 승인 권한을 가진 것으로 봄
export const canApproveExpense = (user: Pick<User, 'user_role' | 'expense_approver'>) =>
    user.user_role === 'admin' || Number(user.expense_approver) === 1;

export type ExpenseForm = { spentOn: string; category: ExpenseCategory | ''; amount: string; title: string; body: string };

const MAX_AMOUNT = 2000000000;

export function validateExpenseForm(f: ExpenseForm): Partial<Record<'spentOn' | 'category' | 'amount' | 'title' | 'body', string>> {
    const errors: Partial<Record<'spentOn' | 'category' | 'amount' | 'title' | 'body', string>> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.spentOn) || Number.isNaN(Date.parse(f.spentOn))) errors.spentOn = '날짜를 선택해 주세요.';
    if (!f.category) errors.category = '분류를 선택해 주세요.';
    const digits = digitsOnly(f.amount);
    if (!digits || Number(digits) > MAX_AMOUNT) errors.amount = '금액은 0원 이상 20억원 이하로 입력해 주세요.';
    const title = f.title.trim();
    if (!title) errors.title = '제목을 입력해 주세요.';
    else if (title.length > 100) errors.title = '제목은 100자까지예요.';
    if (f.body.length > 5000) errors.body = '내용은 5,000자까지예요.';
    return errors;
}

export const toExpensePayload = (f: ExpenseForm) => ({
    spentOn: f.spentOn,
    category: f.category,
    amount: Number(digitsOnly(f.amount)),
    title: f.title.trim(),
    body: f.body,
});

// 'YYYY-MM'을 delta개월 이동
export function shiftMonth(month: string, delta: number): string {
    const [y, m] = month.split('-').map(Number);
    const idx = y * 12 + (m - 1) + delta;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}
