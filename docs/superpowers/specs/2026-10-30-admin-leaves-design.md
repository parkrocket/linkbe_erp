# 관리자 3단계: 근태 현황·대신 취소 — 설계

- 작성일: 2026-10-30 / 상태: 사용자 승인(대화)
- 선행: 잔여 장부, 인사 정보(부서·직급)

## 결정 사항 (사용자)
- 용도: 이번 달 누가 언제 쉬는지, 직원별 사용 내역, 잘못된 신청 바로잡기
- 화면: 월 달력 + 목록 전환. 기간 '월' / '올해 전체'
- 대신 취소: **사유 필수**. 지난 날짜 취소·직원 DM·대신 신청·엑셀은 범위 밖 (지난 근태 보정은 연차·휴가 탭 조정)

## 서버
- `GET /api/admin/leaves?from&to` — 같은 회사 직원 근태(`lk_vacation` JOIN `lk_user`), `id, date(YYYY-MM-DD), type, va_datetime, mb_no, user_name, dept_id, position_id, user_status`, 날짜·이름순. from·to 실존 날짜, from ≤ to, 기간 ≤ 366일 → 아니면 400 `Invalid range`
- `POST /api/admin/leaves/:id/cancel { reason }` — reason trim 1~200자(`Invalid reason`), 다른 회사·없음 404 `Leave not found`, 오늘(KST) 이전 400 `Past date not allowed`
  - 본인 취소(`Apply.cancel`)와 **같은 내부 함수** 사용: 삭제·잔여 복원·장부(kind cancel, 변경자=관리자, memo `{종류} 취소 MM/DD (관리자: 사유)`)·커밋 후 캘린더 삭제
  - 재택은 장부 없음(차감 없음)
  - 커밋 후 `#hibye-관리`: `{관리자}님이 {직원}님의 MM/DD {종류}을(를) 취소했어요 — 사유: {사유}` (이스케이프), Slack 실패는 응답 영향 없음
- DB 변경 없음

## 화면 (`/admin` '근태' 탭)
- 상단: 월 이동, 기간(월/올해), 보기(달력/목록), 필터(직원·부서·종류), 건수 요약(필터 적용)
- 달력: 일요일 시작 6주 이내, 칸마다 최대 2명 + `+N`, 날짜 클릭 → 그날 명단 팝업(대신 취소)
- 목록: 날짜·직원·부서·종류·신청 시각, 오늘 이후만 '대신 취소'
- 대신 취소: 사유 입력 확인 팝업 → 성공 시 화면 유지 새로고침

## 테스트
- `scripts/checkAdminLeaves.js`: 범위 검증, 회사 조건 SQL, 사유, 지난 날짜, 관리자 장부·메모, Slack, 캘린더 삭제, 재택 장부 없음
- `checkApply.js` 회귀(본인 취소)
- vitest `lib/adminLeaves.ts`: 월·올해 범위, 달력 주 만들기, 필터, 종류별 건수, 날짜별 묶기
