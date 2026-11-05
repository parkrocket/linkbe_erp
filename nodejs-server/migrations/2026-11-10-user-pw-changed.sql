-- 직원 비밀번호 변경 시각 — 이 시각 전에 발급된 로그인(JWT iat)은 requireAuth가 거절(다른 기기 로그아웃)
-- 칸 추가만이라 기존 기능에 영향 없음. **코드 배포 전에 실행** (requireAuth가 이 칸을 읽음 — 없으면 모든 API 500)
ALTER TABLE lk_user ADD COLUMN pw_changed_at DATETIME NULL;

-- 되돌리기: 반드시 코드를 먼저 이전 버전으로 되돌린 뒤 실행
-- ALTER TABLE lk_user DROP COLUMN pw_changed_at;
