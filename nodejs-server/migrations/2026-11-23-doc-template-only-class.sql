-- 견적서 양식(예전 유지보수 2·예전 서버 운영 3): 값이 빈 운영 칸은 인쇄에서 숨기도록 class="only-이름" 추가
-- 예전 print_es.php와 같은 규칙: 서버2·자원 칸, 운용 사이트 표는 값이 있을 때만(서버1은 늘 표시) — 이전 때 값 조건(if)을 풀어 버려 빠졌던 것
-- 화면(lib/contract.ts fillTemplate)이 빈 값의 .only-이름 요소를 숨김. 다시 실행해도 바뀌지 않음(이미 바뀐 문자열은 안 맞음)
SET NAMES utf8mb4;

UPDATE wk_doc_template
SET body_html = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(body_html,
    '<td class="back _c">서버2</td>', '<td class="back _c only-운영서버2">서버2</td>'),
    '<td>{운영서버2}</td>', '<td class="only-운영서버2">{운영서버2}</td>'),
    '<td class="back _c">자원</td>', '<td class="back _c only-운영비용">자원</td>'),
    '<td>{운영비용}</td>', '<td class="only-운영비용">{운영비용}</td>'),
    '<div style="margin:0 0 0px 0">', '<div class="only-운영사이트" style="margin:0 0 0px 0">')
WHERE id IN (2, 3) AND kind = 'estimate';

-- 확인: 둘 다 5이면 정상
SELECT id, name, (LENGTH(body_html) - LENGTH(REPLACE(body_html, 'only-', ''))) / LENGTH('only-') AS only_count
FROM wk_doc_template WHERE id IN (2, 3);
