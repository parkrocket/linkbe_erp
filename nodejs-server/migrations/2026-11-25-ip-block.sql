-- 관리: hibye.kr 접속 차단 IP + 직원 마지막 접속 IP(가입·로그인 때 기록 — 관리자 화면에서만 보임)
-- 코드 배포 전에 실행(관리자 직원 목록이 새 칸을 읽음). linkbe.kr(공개 API)은 차단 대상 아님

ALTER TABLE lk_user
    ADD COLUMN last_login_ip VARCHAR(45) NULL,
    ADD COLUMN last_login_at DATETIME NULL;

CREATE TABLE lk_blocked_ip (
    id INT NOT NULL AUTO_INCREMENT,
    cp_id INT NOT NULL,
    ip VARCHAR(45) NOT NULL,
    reason VARCHAR(200) NOT NULL DEFAULT '',
    mb_no INT NULL, -- 직원 목록에서 차단했으면 그 직원(참고용)
    created_by VARCHAR(255) NOT NULL, -- 차단한 관리자 user_id
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uq_ip (ip), INDEX idx_cp (cp_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
