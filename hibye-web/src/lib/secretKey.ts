import { ApiError } from '@/lib/api';

// 암호화 키 확인 오류 문구
export function keyViewErrorText(e: unknown): string {
    if (e instanceof ApiError) {
        if (e.status === 403) return '비밀번호가 맞지 않아요';
        if (e.status === 429) return '시도가 너무 많아요. 15분 뒤 다시 해 주세요.';
        if (e.status === 503) return '서버에 키가 설정되어 있지 않아요.';
    }
    return '확인하지 못했어요. 잠시 후 다시 시도해 주세요.';
}
