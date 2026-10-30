// 인증·가입·관리 API 오류 사유 → 안내 문구 (사유 문자열은 nodejs-server 응답과 동일)

const LOGIN: Record<string, string> = {
    'Pending approval': '가입 승인을 기다리고 있어요. 승인 후 로그인할 수 있어요.',
    'Registration rejected': '가입이 승인되지 않았어요. 관리자에게 문의해 주세요.',
    'Account inactive': '비활성화된 계정이에요. 관리자에게 문의해 주세요.',
};

// 계정 없음·비밀번호 틀림은 같은 문구 — 계정 존재 여부를 드러내지 않음
export function loginErrorMessage(reason?: string) {
    return (reason && LOGIN[reason]) || '이메일 또는 비밀번호를 확인해 주세요.';
}
