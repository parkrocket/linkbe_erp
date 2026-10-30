-- 신입 월차 자동 부여: 장부 종류에 grant(자동 부여) 추가
-- 코드 배포 전에 실행 (자동 부여가 kind='grant'로 기록)
ALTER TABLE lk_balance_log MODIFY kind ENUM('admin', 'apply', 'cancel', 'grant') NOT NULL;

-- 되돌리기: 코드를 먼저 되돌리고 grant 행이 없을 때만
-- ALTER TABLE lk_balance_log MODIFY kind ENUM('admin', 'apply', 'cancel') NOT NULL;
