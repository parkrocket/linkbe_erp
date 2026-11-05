import { apiFetch, ApiError } from '@/lib/api';
import type { Board, InquiryStatus, PopupForm, PostForm } from '@/lib/homepage';
import type { ProductForm } from '@/lib/shop';

// 홈페이지 관리 API (/api/admin/homepage/*) — 권한: 관리자 또는 홈페이지 권한자
const BASE = '/api/admin/homepage';

export const savePost = (board: Board, id: number | null, form: PostForm) =>
    apiFetch<{ ok: boolean; id: number }>(
        `${BASE}/posts/${board}${id ? `/${id}` : ''}`,
        {
            method: 'POST',
            body: {
                title: form.title.trim(),
                bodyHtml: form.bodyHtml,
                isVisible: form.isVisible,
                client: form.client.trim(),
                category: form.category.trim(),
                siteUrl: form.siteUrl.trim(),
                showOnMain: form.showOnMain,
                sortOrder: form.sortOrder.trim() || '0',
                thumbnailFileId: form.thumbnailFileId,
            },
        },
    );
export const deletePost = (board: Board, id: number) =>
    apiFetch(`${BASE}/posts/${board}/${id}`, { method: 'DELETE' });

export const saveFaq = (
    id: number | null,
    body: { question: string; answerHtml: string; isVisible: boolean },
) => apiFetch(`${BASE}/faqs${id ? `/${id}` : ''}`, { method: 'POST', body });
export const moveFaq = (id: number, direction: 'up' | 'down') =>
    apiFetch(`${BASE}/faqs/${id}/move`, {
        method: 'POST',
        body: { direction },
    });
export const deleteFaq = (id: number) =>
    apiFetch(`${BASE}/faqs/${id}`, { method: 'DELETE' });

export const savePopup = (id: number | null, form: PopupForm) =>
    apiFetch(`${BASE}/popups${id ? `/${id}` : ''}`, {
        method: 'POST',
        body: {
            ...form,
            linkUrl: form.linkUrl.trim(),
            posLeft: Number(form.posLeft),
            posTop: Number(form.posTop),
            width: Number(form.width),
        },
    });
export const deletePopup = (id: number) =>
    apiFetch(`${BASE}/popups/${id}`, { method: 'DELETE' });

// create: 새로 만들기 — 같은 주소가 있으면 서버가 409(덮어쓰기 방지)
export const savePage = (
    slug: string,
    body: { title: string; bodyHtml: string; create?: boolean },
) => apiFetch(`${BASE}/pages/${slug}`, { method: 'POST', body });

export const updateInquiry = (
    id: number,
    body: { status: InquiryStatus; adminMemo: string },
) => apiFetch(`${BASE}/inquiries/${id}`, { method: 'POST', body });
export const inquiryFileUrl = (id: number, fileId: number) =>
    `/node${BASE}/inquiries/${id}/files/${fileId}`;

// 이미지 업로드 — multipart라 apiFetch(JSON) 대신 직접 (브라우저 → /node 같은 출처, 쿠키 자동)
export async function uploadImage(
    file: File,
): Promise<{ id: number; url: string }> {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(`/node${BASE}/files`, { method: 'POST', body });
    const data = (await res.json().catch(() => null)) as {
        id?: number;
        url?: string;
        error?: string;
    } | null;
    if (!res.ok || !data?.id || !data.url)
        throw new ApiError(res.status, data?.error);
    return { id: data.id, url: data.url };
}

export function homepageErrorMessage(error: unknown) {
    if (error instanceof ApiError) {
        if (error.reason === 'Invalid file')
            return '이미지 파일(png·jpg·gif·webp, 5MB 이하)만 올릴 수 있어요.';
        if (error.reason === 'Invalid period')
            return '노출 기간을 확인해 주세요.';
        if (error.reason === 'Page exists')
            return '이미 있는 주소예요. 목록에서 그 페이지를 열어 수정해 주세요.';
        if (error.status === 413)
            return '파일이 너무 커요. 이미지는 5MB 이하만 올릴 수 있어요.';
        if (error.reason === 'Not found')
            return '이미 삭제됐거나 찾을 수 없어요. 새로고침해 주세요.';
        if (error.status === 403) return '홈페이지 관리 권한이 없어요.';
        if (error.status === 400 || error.status === 413)
            return '입력값을 확인해 주세요.';
    }
    return '처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

// 고객 회원(개인결제 사이트 가입자) 관리 API — 비밀번호 관련 기능 없음
export type Customer = {
    id: number;
    loginId: string | null;
    name: string;
    email: string | null;
    status: 'active' | 'left';
    createdAt: string;
    lastLoginAt: string | null;
    orderCount: number;
};
export const customersPath = ({ q, page }: { q: string; page: number }) =>
    `/api/admin/shop/members?${new URLSearchParams({ q, page: String(page), size: '30' })}`;
export const leaveCustomer = (id: number) =>
    apiFetch<{ ok: boolean }>(`/api/admin/shop/members/${id}/leave`, {
        method: 'POST',
    });

// ── 개인결제 상품·주문 (/api/admin/shop/*) ──
const SHOP = '/api/admin/shop';
export const saveProduct = (id: number | null, f: ProductForm, expectedUpdatedAt?: string) =>
    apiFetch<{ ok: boolean; id: number }>(`${SHOP}/products${id ? `/${id}` : ''}`, {
        method: 'POST',
        body: {
            title: f.title.trim(),
            price: Number(f.price),
            bodyHtml: f.bodyHtml,
            imageFileId: f.imageFileId,
            isVisible: f.isVisible,
            sortOrder: f.sortOrder.trim() || '0',
            ...(id && { expectedUpdatedAt }),
        },
    });
export const deleteProduct = (id: number) => apiFetch(`${SHOP}/products/${id}`, { method: 'DELETE' });

export const ordersPath = (p: { status: string; payMethod: string; from: string; to: string; q: string; page: number }) =>
    `${SHOP}/orders?${new URLSearchParams(Object.entries({ ...p, page: String(p.page), size: '30' }).filter(([, v]) => v))}`;
export const orderAction = (id: number, action: 'confirm-deposit' | 'complete') =>
    apiFetch(`${SHOP}/orders/${id}/${action}`, { method: 'POST' });
export const saveOrderMemo = (id: number, memo: string) => apiFetch(`${SHOP}/orders/${id}/memo`, { method: 'POST', body: { memo } });
// kcpAlreadyCancelled: KCP 상점관리자에서 이미 취소한 결제 — 서버가 KCP를 부르지 않고 상태만 바꿈
export const cancelOrder = (id: number, reason: string, kcpAlreadyCancelled = false) =>
    apiFetch<{ ok: boolean; refundManually: boolean }>(`${SHOP}/orders/${id}/cancel`, { method: 'POST', body: { reason, kcpAlreadyCancelled } });

// 상품·주문 오류 문구 (공통 문구는 homepageErrorMessage)
export function shopErrorMessage(error: unknown) {
    if (error instanceof ApiError) {
        if (error.reason === 'KCP cancel failed') return `KCP 취소에 실패했어요: ${error.detail ?? ''}`;
        if (error.reason === 'Order changed') return '그사이 주문 상태가 바뀌었어요. 다시 불러올게요.';
        if (error.reason === 'Invalid transition') return '이 상태에서는 할 수 없는 작업이에요.';
        if (error.reason === 'Product changed') return '다른 사람이 먼저 수정했어요. 다시 불러온 뒤 수정해 주세요.';
        if (error.reason === 'Has orders') return '주문이 있어 삭제할 수 없어요. 판매 안 함으로 바꿔 주세요.';
        if (error.reason === 'Order not found') return '주문을 찾을 수 없어요. 새로고침해 주세요.';
    }
    return homepageErrorMessage(error);
}
