-- 회사 홈페이지 콘텐츠·문의 (hp_ 테이블) + 홈페이지 관리 권한
-- 공개 사이트(linkbe-web)는 공개 API로 읽기만, 관리는 hibye 관리 화면 '홈페이지' 탭
-- 추가만이라 기존 기능 영향 없음 — 코드 배포 전에 실행

-- 공지·포트폴리오 (board로 구분)
CREATE TABLE hp_post (
    id INT NOT NULL AUTO_INCREMENT,
    board VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body_html MEDIUMTEXT NOT NULL,
    thumbnail_file_id INT NULL,
    client VARCHAR(100) NULL,
    category VARCHAR(50) NULL,
    site_url VARCHAR(300) NULL,
    show_on_main TINYINT(1) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    is_visible TINYINT(1) NOT NULL DEFAULT 1,
    legacy_wr_id INT NULL,
    created_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_board (board, is_visible, sort_order),
    INDEX idx_legacy (board, legacy_wr_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE hp_faq (
    id INT NOT NULL AUTO_INCREMENT,
    question VARCHAR(300) NOT NULL,
    answer_html MEDIUMTEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_visible TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 메인 팝업 — 기간 안이고 보이기일 때만 노출
CREATE TABLE hp_popup (
    id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    image_file_id INT NULL,
    link_url VARCHAR(300) NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    pos_left INT NOT NULL DEFAULT 10,
    pos_top INT NOT NULL DEFAULT 10,
    width INT NOT NULL DEFAULT 400,
    is_visible TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 안내 페이지(개인정보처리방침 등)
CREATE TABLE hp_page (
    slug VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body_html MEDIUMTEXT NOT NULL,
    updated_by INT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (slug)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 1:1 문의·견적 요청 (개인정보 — 관리자 API로만)
CREATE TABLE hp_inquiry (
    id INT NOT NULL AUTO_INCREMENT,
    kind VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    company VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    category VARCHAR(50) NULL,
    contact_method VARCHAR(10) NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    admin_memo TEXT NULL,
    ip VARCHAR(45) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_status (status, created_at),
    INDEX idx_ip (ip, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 업로드 파일 — public(공지·포트폴리오·팝업 이미지) / private(문의 첨부)
CREATE TABLE hp_file (
    id INT NOT NULL AUTO_INCREMENT,
    owner_type VARCHAR(20) NULL,
    owner_id INT NULL,
    visibility VARCHAR(10) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(64) NOT NULL,
    mime VARCHAR(100) NOT NULL,
    size INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_owner (owner_type, owner_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 홈페이지 관리 권한 (hibye 관리자는 항상 가능)
ALTER TABLE lk_user ADD COLUMN homepage_access TINYINT(1) NOT NULL DEFAULT 0;

-- 되돌리기: 코드를 먼저 되돌린 뒤
-- DROP TABLE hp_file, hp_inquiry, hp_page, hp_popup, hp_faq, hp_post;
-- ALTER TABLE lk_user DROP COLUMN homepage_access;
