-- 업무 도구 3-2: 견적·계약서 (wk_ 테이블 6개)
-- 새 테이블만 추가라 기존 기능 영향 없음 — 코드 배포 전에 실행

CREATE TABLE wk_doc_category (
    id INT NOT NULL AUTO_INCREMENT, cp_id INT NOT NULL, name VARCHAR(50) NOT NULL, sort INT NOT NULL DEFAULT 0,
    legacy_code VARCHAR(30) NULL,
    PRIMARY KEY (id), UNIQUE KEY uq_legacy (cp_id, legacy_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE wk_item_template (
    id INT NOT NULL AUTO_INCREMENT, cp_id INT NOT NULL, category_id INT NOT NULL,
    group_name VARCHAR(100) NOT NULL DEFAULT '', content VARCHAR(255) NOT NULL, unit_price INT NOT NULL DEFAULT 0,
    qty INT NOT NULL DEFAULT 0, period INT NOT NULL DEFAULT 0, note VARCHAR(255) NOT NULL DEFAULT '',
    kind VARCHAR(10) NOT NULL DEFAULT 'normal', sort INT NOT NULL DEFAULT 0, legacy_id INT NULL,
    PRIMARY KEY (id), UNIQUE KEY uq_legacy (legacy_id), INDEX idx_cat (cp_id, category_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE wk_contract (
    id INT NOT NULL AUTO_INCREMENT, cp_id INT NOT NULL, doc_no VARCHAR(30) NOT NULL, category_id INT NULL,
    company_name VARCHAR(100) NOT NULL, biz_no VARCHAR(30) NOT NULL DEFAULT '', ceo_name VARCHAR(50) NOT NULL DEFAULT '',
    company_email VARCHAR(150) NOT NULL DEFAULT '', project_name VARCHAR(200) NOT NULL DEFAULT '',
    contract_date DATE NULL, delivery_date DATE NULL, work_period VARCHAR(100) NOT NULL DEFAULT '',
    memo TEXT NOT NULL, link1 VARCHAR(500) NOT NULL DEFAULT '', link2 VARCHAR(500) NOT NULL DEFAULT '',
    total INT NOT NULL DEFAULT 0, deposit INT NOT NULL DEFAULT 0, balance INT NOT NULL DEFAULT 0, paid_amount INT NOT NULL DEFAULT 0,
    is_hold TINYINT(1) NOT NULL DEFAULT 0, is_cancelled TINYINT(1) NOT NULL DEFAULT 0, is_paid_full TINYINT(1) NOT NULL DEFAULT 0, invoice_issued TINYINT(1) NOT NULL DEFAULT 0,
    ops_server1 TEXT NOT NULL, ops_server2 TEXT NOT NULL, ops_spend TEXT NOT NULL, ops_site VARCHAR(500) NOT NULL DEFAULT '',
    created_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    legacy_wr_id INT NULL,
    PRIMARY KEY (id), UNIQUE KEY uq_legacy (legacy_wr_id), INDEX idx_cp_date (cp_id, contract_date), INDEX idx_cp_company (cp_id, company_name), INDEX idx_cp_docno (cp_id, doc_no)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE wk_contract_item (
    id INT NOT NULL AUTO_INCREMENT, contract_id INT NOT NULL, sort INT NOT NULL DEFAULT 0,
    group_name VARCHAR(100) NOT NULL DEFAULT '', content VARCHAR(255) NOT NULL, unit_price INT NOT NULL DEFAULT 0,
    qty INT NOT NULL DEFAULT 0, period INT NOT NULL DEFAULT 0, note VARCHAR(255) NOT NULL DEFAULT '',
    kind VARCHAR(10) NOT NULL DEFAULT 'normal', legacy_id INT NULL,
    PRIMARY KEY (id), UNIQUE KEY uq_legacy (legacy_id), INDEX idx_contract (contract_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE wk_contract_manager (
    id INT NOT NULL AUTO_INCREMENT, contract_id INT NOT NULL, sort INT NOT NULL DEFAULT 0,
    name VARCHAR(50) NOT NULL DEFAULT '', phone VARCHAR(50) NOT NULL DEFAULT '', email VARCHAR(150) NOT NULL DEFAULT '', memo VARCHAR(255) NOT NULL DEFAULT '',
    legacy_id INT NULL,
    PRIMARY KEY (id), UNIQUE KEY uq_legacy (legacy_id), INDEX idx_contract (contract_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE wk_doc_template (
    id INT NOT NULL AUTO_INCREMENT, cp_id INT NOT NULL, kind VARCHAR(10) NOT NULL, name VARCHAR(100) NOT NULL,
    category_id INT NULL, body_html MEDIUMTEXT NOT NULL, css MEDIUMTEXT NOT NULL, is_default TINYINT(1) NOT NULL DEFAULT 0,
    legacy_key VARCHAR(100) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uq_legacy (cp_id, legacy_key), INDEX idx_kind (cp_id, kind)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
