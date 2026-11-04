import { apiFetch, ApiError } from '@/lib/api';

// 설정 API 호출 도우미 — 쓰기는 모두 POST(저장·이동)·DELETE
export const SETTINGS_API = '/api/work/doc-settings';
export const postSetting = (path: string, body: unknown) => apiFetch<{ id?: number; ok?: boolean }>(`${SETTINGS_API}${path}`, { method: 'POST', body });
export const deleteSetting = (path: string) => apiFetch(`${SETTINGS_API}${path}`, { method: 'DELETE' });

export const CATEGORY_IN_USE = '계약·품목 문구·양식에서 쓰는 분류는 지울 수 없어요';
export const TEMPLATE_CHANGED = '다른 사람이 먼저 고쳤어요. 새로 불러온 뒤 다시 고쳐 주세요.';

// 서버 오류 사유 → 사용자 문구
export function settingsError(e: unknown): string {
    if (e instanceof ApiError) {
        if (e.reason === 'In use') return CATEGORY_IN_USE;
        if (e.reason === 'Template changed') return TEMPLATE_CHANGED;
        if (e.reason === 'Invalid categoryId') return '분류를 찾을 수 없어요. 삭제됐을 수 있으니 새로고침해 주세요.';
        if (e.reason === 'Invalid name') return '이름을 입력해 주세요. (너무 길면 저장할 수 없어요)';
        if (e.reason === 'Invalid item') return '내용은 꼭 입력하고, 단가·수량·기간이 범위 안인지 확인해 주세요.';
        if (e.status === 404) return '찾을 수 없어요. 이미 삭제됐을 수 있어요.';
        if (e.status === 403) return '업무 문서 권한이 없어요.';
    }
    return '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
}

export type Notice = { tone: 'ok' | 'error'; text: string } | null;
