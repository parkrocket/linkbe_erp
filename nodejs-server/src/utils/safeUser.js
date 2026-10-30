// lk_user를 SELECT * 로 조인한 행을 직원용 응답으로 내보낼 때 민감 칸 제거
// 비밀번호 해시 + 개인정보(생년월일·성별) + 캘린더 토큰 — 관리자 API는 명시 컬럼으로 별도 조회
const HIDDEN_COLUMNS = ['user_password', 'user_birth', 'user_gender', 'calendar_token'];

const toSafeUser = row => {
    const safeUser = { ...row };
    for (const column of HIDDEN_COLUMNS) delete safeUser[column];
    return safeUser;
};

module.exports = { toSafeUser };
