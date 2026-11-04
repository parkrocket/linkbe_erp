-- 업무 도구 3-4: 거래처 접속정보(암호화)·첨부·바이럴 게시판
-- 권한 칸 추가 — requireAuth가 새 칸을 읽으므로 코드 배포(push) 전에 반드시 실행 (없으면 전 API 500)
-- 새 테이블은 기존 기능 영향 없음. 서버 .env·Secrets에 CLIENT_SECRET_KEY(base64 32바이트) 필요 — 분실하면 복구 불가
ALTER TABLE lk_user ADD COLUMN client_secret_access TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE wk_client (id INT NOT NULL AUTO_INCREMENT, cp_id INT NOT NULL, kind VARCHAR(10) NOT NULL DEFAULT 'client', name VARCHAR(100) NOT NULL,
  legacy_memo_enc MEDIUMTEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  legacy_wr_id INT NULL, PRIMARY KEY (id), UNIQUE KEY uq_legacy (cp_id, legacy_wr_id), INDEX idx_cp_name (cp_id, name)) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE TABLE wk_client_credential (id INT NOT NULL AUTO_INCREMENT, client_id INT NOT NULL, kind VARCHAR(10) NOT NULL, label VARCHAR(100) NOT NULL DEFAULT '',
  url VARCHAR(500) NOT NULL DEFAULT '', login_id VARCHAR(200) NOT NULL DEFAULT '', secret_enc TEXT NULL, memo_enc TEXT NULL, sort INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), INDEX idx_client (client_id)) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE TABLE wk_credential_log (id INT NOT NULL AUTO_INCREMENT, cp_id INT NOT NULL, client_id INT NOT NULL, credential_id INT NULL, file_id INT NULL,
  target VARCHAR(10) NOT NULL, action VARCHAR(10) NOT NULL, actor_no INT NULL, actor_name VARCHAR(50) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), INDEX idx_client (cp_id, client_id, id)) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE TABLE wk_file (id INT NOT NULL AUTO_INCREMENT, cp_id INT NOT NULL, owner_type VARCHAR(20) NOT NULL, owner_id INT NOT NULL, original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(64) NOT NULL, mime VARCHAR(100) NOT NULL, size INT NOT NULL, created_by INT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  legacy_key VARCHAR(100) NULL, PRIMARY KEY (id), UNIQUE KEY uq_legacy (cp_id, legacy_key), INDEX idx_owner (cp_id, owner_type, owner_id)) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE TABLE wk_board_post (id INT NOT NULL AUTO_INCREMENT, cp_id INT NOT NULL, board VARCHAR(20) NOT NULL, title VARCHAR(200) NOT NULL, body_html MEDIUMTEXT NOT NULL,
  writer_no INT NULL, writer_name VARCHAR(50) NOT NULL DEFAULT '', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, legacy_wr_id INT NULL,
  PRIMARY KEY (id), UNIQUE KEY uq_legacy (cp_id, board, legacy_wr_id), INDEX idx_board (cp_id, board, id)) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE TABLE wk_board_comment (id INT NOT NULL AUTO_INCREMENT, post_id INT NOT NULL, body TEXT NOT NULL, writer_no INT NULL, writer_name VARCHAR(50) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, legacy_wr_id INT NULL, PRIMARY KEY (id), UNIQUE KEY uq_legacy (post_id, legacy_wr_id), INDEX idx_post (post_id)) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
