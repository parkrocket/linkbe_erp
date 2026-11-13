-- 거래처 접속정보: 업체 메모(암호화 저장, 상세에 바로 표시)·별표(목록 위로 — 회사 공용)
-- 목록·상세가 새 칸을 읽으므로 코드 배포(push) 전에 반드시 실행 (없으면 거래처 API 500). 기존 업체는 메모 없음·별표 없음
ALTER TABLE wk_client
  ADD COLUMN memo_enc MEDIUMTEXT NULL AFTER legacy_memo_enc,
  ADD COLUMN starred TINYINT(1) NOT NULL DEFAULT 0;
