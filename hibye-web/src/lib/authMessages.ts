// 인증·가입·관리 API 오류 사유 → 안내 문구 (사유 문자열은 nodejs-server 응답과 동일)
import { ApiError } from './api';

const LOGIN: Record<string, string> = {
    'Pending approval': '가입 승인을 기다리고 있어요. 승인 후 로그인할 수 있어요.',
    'Registration rejected': '가입이 승인되지 않았어요. 관리자에게 문의해 주세요.',
    'Account inactive': '비활성화된 계정이에요. 관리자에게 문의해 주세요.',
};

// 계정 없음·비밀번호 틀림은 같은 문구 — 계정 존재 여부를 드러내지 않음
export function loginErrorMessage(reason?: string) {
    return (reason && LOGIN[reason]) || '이메일 또는 비밀번호를 확인해 주세요.';
}

// 회원가입 API 오류 → 안내
export function registerErrorMessage(error: unknown) {
    if (error instanceof ApiError) {
        if (error.reason === 'Email already registered') return '이미 가입된 이메일이에요.';
        if (error.reason === 'Registration rejected') return '가입이 승인되지 않은 이메일이에요. 관리자에게 문의해 주세요.';
        if (error.status === 400) return '입력한 내용을 확인해 주세요.';
    }
    return '가입 신청 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
}

// 관리자 API 오류 → 안내
export function adminErrorMessage(error: unknown) {
    if (error instanceof ApiError) {
        if (error.reason === 'Leave not found') return '이미 취소됐거나 찾을 수 없는 근태예요. 새로고침해 주세요.';
        if (error.reason === 'Past date not allowed') return '지난 근태는 취소할 수 없어요. 연차·휴가 탭에서 일수를 조정해 주세요.';
        if (error.reason === 'Invalid range') return '조회 기간을 확인해 주세요.';
        if (error.reason === 'Cannot change yourself') return '자기 자신은 변경할 수 없어요.';
        if (error.reason === 'Last admin') return '관리자는 최소 1명 있어야 해요.';
        if (error.reason === 'Invalid transition') return '지금 상태에서는 할 수 없는 작업이에요.';
        if (error.reason === 'Duplicate name') return '이미 있는 이름이에요.';
        if (error.reason === 'In use') return '소속 직원이 있어 삭제할 수 없어요. 이름 변경만 가능해요.';
        if (error.reason === 'Invalid department' || error.reason === 'Invalid position') {
            return '부서·직급 목록이 바뀌었어요. 새로고침 후 다시 선택해 주세요.';
        }
        if (['Invalid name', 'Invalid phone', 'Invalid doe', 'Invalid birth', 'Invalid gender', 'Invalid employment type'].includes(error.reason ?? '')) {
            return '입력값을 확인해 주세요.';
        }
        if (error.reason === 'Balance changed') return '그 사이 잔여가 바뀌었어요. 다시 불러온 뒤 입력해 주세요.';
        if (error.reason === 'Invalid reason') return '사유를 1~200자로 입력해 주세요.';
        if (error.reason === 'Invalid balance' || error.reason === 'Invalid changes') return '입력값을 확인해 주세요.';
        if (error.reason === 'No changes') return '바뀐 값이 없어요.';
        if (error.status === 403) return '관리자만 할 수 있어요.';
        if (error.status === 404) return '대상 직원을 찾을 수 없어요. 새로고침 후 다시 시도해 주세요.';
    }
    return '처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}
