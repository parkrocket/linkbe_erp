-- 공휴일(대체·임시공휴일 포함) — 한국천문연구원 특일정보 API에서 매일 받아 저장 (controllers/holidayCron.js)
-- 근태 신청 차단(applyModel)·달력 표시가 이 표를 읽음. **코드 배포 전에 실행** (없으면 근태 신청·일정 조회 500)
CREATE TABLE lk_holiday (
    holiday_date DATE NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 되돌리기: 반드시 코드를 먼저 이전 버전으로 되돌린 뒤 실행
-- DROP TABLE lk_holiday;
