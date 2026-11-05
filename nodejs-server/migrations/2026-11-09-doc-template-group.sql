-- 견적·계약서 양식 그룹(고객사별 양식 묶음 — 기본·로엘·도담 등). NULL = 기본
-- 코드 배포 전에 실행(양식 조회가 group_name을 읽음)
ALTER TABLE wk_doc_template ADD COLUMN group_name VARCHAR(50) NULL AFTER name;

-- 예전에서 옮긴 고객사 전용 양식의 그룹 (11-05 이전분 — legacy_key로 찾음, 나머지는 NULL = 기본)
UPDATE wk_doc_template SET group_name = '로엘' WHERE legacy_key IN ('print_contract_cont_lawl_202608', 'print_contract_cont_lawl_1', 'print_contract_cont_lawl', 'print_contract_lawl');
UPDATE wk_doc_template SET group_name = '도담' WHERE legacy_key = 'print_contract_dodam';
UPDATE wk_doc_template SET group_name = 'YK' WHERE legacy_key = 'print_contract_server_cont_yk';
UPDATE wk_doc_template SET group_name = '오늘' WHERE legacy_key IN ('print_es_onul', 'print_contract_v_marketing_onul');
UPDATE wk_doc_template SET group_name = '직인 없음' WHERE legacy_key = 'print_es_no';
