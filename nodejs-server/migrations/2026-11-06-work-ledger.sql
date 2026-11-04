-- 업무 도구 3-3: 매출/매입 장부·계정과목 (wk_ 테이블 2개)
-- 새 테이블만 추가라 기존 기능 영향 없음 — 코드 배포 전에 실행

CREATE TABLE wk_account (
    id INT NOT NULL AUTO_INCREMENT, cp_id INT NOT NULL, side VARCHAR(10) NOT NULL, code VARCHAR(10) NOT NULL,
    label VARCHAR(50) NOT NULL DEFAULT '', name VARCHAR(100) NOT NULL, sort INT NOT NULL DEFAULT 0, legacy_id INT NULL,
    PRIMARY KEY (id), UNIQUE KEY uq_code (cp_id, side, code), UNIQUE KEY uq_legacy (legacy_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE wk_ledger (
    id INT NOT NULL AUTO_INCREMENT, cp_id INT NOT NULL, side VARCHAR(10) NOT NULL, entry_date DATE NOT NULL,
    account_id INT NOT NULL, title VARCHAR(200) NOT NULL, memo TEXT NOT NULL,
    supply INT NOT NULL DEFAULT 0, tax INT NOT NULL DEFAULT 0, total INT NOT NULL DEFAULT 0,
    created_by INT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, legacy_wr_id INT NULL,
    PRIMARY KEY (id), UNIQUE KEY uq_legacy (legacy_wr_id), INDEX idx_cp_date (cp_id, entry_date), INDEX idx_account (account_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
