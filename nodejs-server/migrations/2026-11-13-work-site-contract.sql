-- 업무 도구: 계약 관리(업체별 홈페이지 계약 기간 — 예전 c_homepage_con) (wk_ 테이블 1개)
-- 새 테이블만 추가라 기존 기능 영향 없음 — 코드 배포 전에 실행

CREATE TABLE wk_site_contract (
    id INT NOT NULL AUTO_INCREMENT, cp_id INT NOT NULL, code VARCHAR(100) NOT NULL DEFAULT '', company_name VARCHAR(200) NOT NULL,
    site_url VARCHAR(255) NOT NULL DEFAULT '', start_date DATE NULL, end_date DATE NULL, status VARCHAR(10) NOT NULL DEFAULT 'run',
    email VARCHAR(200) NOT NULL DEFAULT '', memo TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, legacy_id INT NULL,
    PRIMARY KEY (id), UNIQUE KEY uq_legacy (legacy_id), INDEX idx_cp (cp_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
