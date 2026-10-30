-- 직원 인사 정보: 성별·생년월일·부서·직급·고용형태 + 회사별 부서·직급 목록
-- 칸·테이블 추가만이라 기존 기능에 영향 없음 — 코드 배포 전에 실행
-- 입사일은 기존 user_doe 사용
ALTER TABLE lk_user
    ADD COLUMN user_gender VARCHAR(10) NULL,
    ADD COLUMN user_birth DATE NULL,
    ADD COLUMN dept_id INT NULL,
    ADD COLUMN position_id INT NULL,
    ADD COLUMN employment_type VARCHAR(20) NULL;

CREATE TABLE lk_department (
    id INT NOT NULL AUTO_INCREMENT,
    cp_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_company_name (cp_id, name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE lk_position (
    id INT NOT NULL AUTO_INCREMENT,
    cp_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_company_name (cp_id, name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 되돌리기: 반드시 코드를 먼저 이전 버전으로 되돌린 뒤 실행
-- DROP TABLE lk_position; DROP TABLE lk_department;
-- ALTER TABLE lk_user DROP COLUMN user_gender, DROP COLUMN user_birth, DROP COLUMN dept_id, DROP COLUMN position_id, DROP COLUMN employment_type;
