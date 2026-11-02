// 개인결제 상품·주문 관리 — 이름표·표시 형식·타입 (서버 adminShopController 응답 모양)
export const ORDER_STATUS_LABEL = {
    pending: '결제 대기',
    awaiting_deposit: '입금 대기',
    paid: '입금 완료',
    completed: '완료',
    cancelled: '취소',
} as const;
export type OrderStatus = keyof typeof ORDER_STATUS_LABEL;

// vbank: 예전 주문의 가상계좌 표시용
export const PAY_METHOD_LABEL = { card: '카드', bank: '계좌이체', deposit: '무통장입금', vbank: '가상계좌' } as const;
export type PayMethod = keyof typeof PAY_METHOD_LABEL;

export type OrderRow = {
    id: number;
    orderNo: string;
    productTitle: string;
    amount: number;
    buyerName: string;
    payMethod: PayMethod;
    status: OrderStatus;
    depositName: string | null;
    vbankDue: string | null;
    paidAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    buyerEmail?: string | null;
    buyerPhone?: string | null;
    buyerMemo?: string | null;
    adminMemo?: string | null;
    kcpTno?: string | null;
    vbankBank?: string | null;
    vbankAccount?: string | null;
    vbankHolder?: string | null;
    history?: string | null;
};

export type ProductRow = {
    id: number;
    title: string;
    price: number;
    imageFileId: number | null;
    isVisible: boolean;
    sortOrder: number;
    updatedAt: string;
    orderCount?: number;
    bodyHtml?: string;
};

export const formatWon = (n: number) => `${Number(n).toLocaleString('ko-KR')}원`;

// 가격 입력 — 숫자만 남김
export const digitsOnly = (v: string) => v.replace(/\D/g, '');

export type ProductForm = { title: string; price: string; bodyHtml: string; imageFileId: number | null; isVisible: boolean; sortOrder: string };

export function validateProductForm(f: ProductForm): Partial<Record<'title' | 'price' | 'sortOrder', string>> {
    const errors: Partial<Record<'title' | 'price' | 'sortOrder', string>> = {};
    if (!f.title.trim()) errors.title = '상품명을 입력해 주세요.';
    else if (f.title.trim().length > 200) errors.title = '상품명은 200자까지예요.';
    const price = Number(f.price);
    if (!/^\d+$/.test(f.price) || price < 1 || price > 100000000) errors.price = '1원 이상 1억원 이하로 입력해 주세요.';
    if (f.sortOrder.trim() && !/^\d+$/.test(f.sortOrder.trim())) errors.sortOrder = '0 이상의 정수로 입력해 주세요.';
    return errors;
}

// 취소 확인 창 문구 — 카드·계좌이체는 KCP까지 취소, 무통장은 직접 환불
export const cancelConfirmText = (m: PayMethod) =>
    m === 'deposit'
        ? '정말 취소할까요? 입금된 주문이면 계좌로 직접 환불해야 해요.'
        : '정말 취소할까요? 카드·계좌이체는 KCP 결제까지 취소되고 되돌릴 수 없어요.';
