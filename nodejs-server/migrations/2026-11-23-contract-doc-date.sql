-- 견적·계약서 작성일(문서에 찍는 날짜) — 작성 화면에서 고침, 새 문서 기본 오늘. 비어 있으면(예전 문서) 인쇄는 등록 시각(created_at) 날짜
-- 목록 정렬은 그대로 created_at. 코드 배포 전에 실행(상세 조회가 이 칸을 읽음)
ALTER TABLE wk_contract ADD COLUMN doc_date DATE NULL AFTER doc_no;
