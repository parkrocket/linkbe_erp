-- 관리자 기능 2단계: 잔여 장부 (연차 user_stip·휴가 user_vaca가 바뀔 때마다 1행)
-- kind: admin(관리자 조정) / apply(근태 신청) / cancel(근태 취소), 재택은 차감이 없어 기록하지 않음
-- 신청·취소가 같은 트랜잭션에서 이 테이블에 쓰므로 반드시 코드 배포 전에 실행
CREATE TABLE lk_balance_log (
    id INT NOT NULL AUTO_INCREMENT,
    cp_id INT NOT NULL,
    mb_no INT NOT NULL,
    actor_mb_no INT NOT NULL,
    kind ENUM('admin', 'apply', 'cancel') NOT NULL,
    stip_before FLOAT NULL,
    stip_after FLOAT NULL,
    vaca_before INT NULL,
    vaca_after INT NULL,
    memo VARCHAR(200) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_member (cp_id, mb_no, id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 되돌리기:
-- DROP TABLE lk_balance_log;
