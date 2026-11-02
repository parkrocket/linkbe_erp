-- 고객 회원·개인결제 (hp_ 테이블) — 직원 lk_user와 별개
-- 공개 사이트(linkbe-web) 회원 로그인 + 개인결제 상품·주문
-- 추가만이라 기존 기능 영향 없음 — 코드 배포 전에 실행

-- 고객 회원 (탈퇴 시 login_id·password_hash·email·phone·재설정 토큰을 NULL로 비우고 status=left)
CREATE TABLE hp_member (
    id INT NOT NULL AUTO_INCREMENT,
    login_id VARCHAR(50) NULL,
    password_hash VARCHAR(100) NULL,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(150) NULL,
    phone VARCHAR(20) NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'active',
    agreed_at DATETIME NULL,
    reset_token_hash CHAR(64) NULL,
    reset_expires_at DATETIME NULL,
    password_changed_at DATETIME NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME NULL,
    legacy_mb_no INT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_login_id (login_id),
    UNIQUE KEY uq_email (email),
    UNIQUE KEY uq_legacy_mb_no (legacy_mb_no),
    INDEX idx_reset (reset_token_hash)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 개인결제 상품
CREATE TABLE hp_product (
    id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    price INT NOT NULL,
    body_html MEDIUMTEXT NOT NULL,
    image_file_id INT NULL,
    is_visible TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    legacy_it_id VARCHAR(20) NULL,
    created_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_legacy_it_id (legacy_it_id),
    INDEX idx_visible (is_visible, sort_order)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 주문 (1건 = 상품 1개). 외래키 없음 — 탈퇴·상품 삭제 후에도 복사본으로 표시
CREATE TABLE hp_order (
    id INT NOT NULL AUTO_INCREMENT,
    order_no VARCHAR(40) NOT NULL,
    member_id INT NULL,
    product_id INT NULL,
    product_title VARCHAR(200) NOT NULL,
    amount INT NOT NULL,
    buyer_name VARCHAR(50) NOT NULL,
    buyer_email VARCHAR(150) NULL,
    buyer_phone VARCHAR(30) NULL,
    pay_method VARCHAR(10) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    kcp_tno VARCHAR(40) NULL,
    kcp_app_no VARCHAR(40) NULL,
    vbank_bank VARCHAR(50) NULL,
    vbank_account VARCHAR(50) NULL,
    vbank_holder VARCHAR(50) NULL,
    vbank_due DATETIME NULL,
    deposit_name VARCHAR(50) NULL,
    buyer_memo TEXT NULL,
    admin_memo TEXT NULL,
    history TEXT NOT NULL,
    paid_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    legacy_od_id VARCHAR(30) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_order_no (order_no),
    UNIQUE KEY uq_legacy_od_id (legacy_od_id),
    INDEX idx_status (status, created_at),
    INDEX idx_member (member_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 되돌리기: 코드를 먼저 되돌린 뒤
-- DROP TABLE hp_order, hp_product, hp_member;
