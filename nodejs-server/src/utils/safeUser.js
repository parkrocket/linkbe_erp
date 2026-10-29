// lk_user를 SELECT * 로 조인한 행에서 비밀번호 해시 제거 — 응답으로 내려보내지 않기 위함
const toSafeUser = ({ user_password, ...safeUser }) => safeUser;

module.exports = { toSafeUser };
