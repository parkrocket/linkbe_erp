-- 거래처 접속정보 '호스팅 세트'(kind 'site'): 서버(FTP/SFTP·포트) + 사이트 관리자 + DB를 한 항목에
-- 목록·상세가 새 칸을 읽으므로 코드 배포(push) 전에 반드시 실행 (없으면 거래처 API 500). 기존 항목은 새 칸이 비어 있을 뿐 그대로
-- 서버 주소·포트는 기존 url(ftp://·sftp://)·새 port 칸, 서버 아이디·비밀번호는 기존 login_id·secret_enc
ALTER TABLE wk_client_credential
  ADD COLUMN port SMALLINT UNSIGNED NULL AFTER url,
  ADD COLUMN admin_url VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN admin_id VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN admin_secret_enc TEXT NULL,
  ADD COLUMN db_host VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN db_name VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN db_id VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN db_secret_enc TEXT NULL;
