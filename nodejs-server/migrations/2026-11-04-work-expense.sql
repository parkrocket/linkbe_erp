-- 업무 도구 3-1: 업무 문서·경비 승인 권한 + 경비 기안 (wk_ 테이블)
-- 추가만이라 기존 기능 영향 없음 — 코드 배포 전에 실행

ALTER TABLE lk_user
    ADD COLUMN work_doc_access TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN expense_approver TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE wk_expense (
    id INT NOT NULL AUTO_INCREMENT,
    cp_id INT NOT NULL,
    writer_no INT NULL,
    writer_name VARCHAR(50) NOT NULL,
    spent_on DATE NOT NULL,
    category VARCHAR(10) NOT NULL,
    amount INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending',
    history TEXT NOT NULL,
    legacy_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_legacy_id (legacy_id),
    INDEX idx_cp_spent (cp_id, spent_on),
    INDEX idx_cp_status (cp_id, status),
    INDEX idx_writer (writer_no)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
