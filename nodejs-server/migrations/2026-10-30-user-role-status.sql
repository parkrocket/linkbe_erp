-- 관리자 기능 1단계: lk_user 권한·상태 추가
-- 기존 행은 기본값으로 member / approved (기존 직원은 자동 승인 상태)
-- 새 가입은 애플리케이션이 user_status='pending'으로 명시 저장
-- 첫 관리자 지정은 개인정보라 이 파일에 넣지 않고 서버에서 직접 실행
ALTER TABLE lk_user
    ADD COLUMN user_role VARCHAR(20) NOT NULL DEFAULT 'member',
    ADD COLUMN user_status VARCHAR(20) NOT NULL DEFAULT 'approved';

-- 되돌리기:
-- ALTER TABLE lk_user DROP COLUMN user_role, DROP COLUMN user_status;
