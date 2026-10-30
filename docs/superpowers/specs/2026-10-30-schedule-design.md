# 일정 화면(/calendar) — 설계

- 작성일: 2026-10-30 / 상태: 사용자 승인(대화)

## 결정 사항 (사용자)
- 일반 일정 추가는 누구나, **수정·삭제는 만든 사람 + 관리자**. 만든 사람 정보가 없는 기존 일정은 관리자만
- 근태 신청으로 생긴 일정은 **보기만**(수정·삭제 403) — 취소는 근태 화면/관리 근태 탭
- 하루 종일(여러 날) + **시간 지정** 일정
- 범위 밖: 반복·참석자·알림, 일정 Slack 알림, 공휴일 근태 차단(다음 작업 후보)

## 기존 보안 결함 (이번에 수정)
`/api/calendar/update`·`/delete`가 로그인한 누구에게나 회사 캘린더 **모든 일정** 수정·삭제를 허용 — 근태 일정을 지우면 캘린더와 근태 기록·잔여가 어긋남

## 서버 (기존 `/api/calendar/*` 수정 — react-app과 공용, 응답은 필드 추가만)
- 일정 입력 검증 `utils/eventValidation.js` `validateEvent(body)`:
  - 새 형식 `{ summary, description?, allDay: true, startDate, endDate }`(끝 날짜 포함) / `{ allDay: false, startDateTime, endDateTime }`('YYYY-MM-DDTHH:mm', KST)
  - 기존 형식 `{ summary, start: { date }, end: { date } }`(YYYY-MM-DD만, 끝 포함으로 해석)
  - 제목 trim 1~100, 메모 ≤ 500, 하루 종일 시작 ≤ 끝·최대 31일, 시간 시작 < 끝·최대 31일
  - 오류: `Invalid summary`/`Invalid description`/`Invalid date`
  - 기존 react-app: 추가는 끝 = 시작(하루), 수정은 FullCalendar 끝 날짜(미포함)를 보냄 → 끝 > 시작이면 그대로 저장(+1 안 함). 수정 시 메모는 비워짐(기존 화면에 메모 없음) — 전환 시 퇴역
- 수정은 `events.patch`(부분 수정) — Google에서 직접 넣은 위치·참석자 등 보존, 하루 종일↔시간 전환 시 반대쪽 칸 null
- Google 저장: 하루 종일은 끝 날짜 +1(Google은 끝 미포함), 시간은 `dateTime` + `timeZone: 'Asia/Seoul'`. 만든 사람 `extendedProperties.private.hibyeCreator = mb_no`
- 수정·삭제: `events.get`으로 다시 읽어 확인 → 없음 404 `Event not found` / 근태 일정(`lk_vacation.calendar_id` 일치) 403 `Leave event` / 본인·관리자 아님(만든 사람 없음 포함) 403 `Not allowed`. 수정 시 만든 사람 정보 유지
- 조회 `GET /events?timeMin&timeMax`(ISO, 최대 62일, 아니면 400 `Invalid range`) — 기존 필드(id, title, start, end, allDay, className) + `kind`(event/leave/holiday), `canEdit`, `creatorName`, `description`, `startDate`·`endDate`(하루 종일, 끝 포함)

## 화면 (hibye-web `/calendar`)
- 월 달력(근태 탭과 같은 계산), 칸에 공휴일(빨강)·근태(종류 색)·일정(보라, 시간 일정은 `10:00 제목`), 여러 날은 날마다, 넘치면 +N → 날짜 목록 팝업
- 추가 팝업(날짜 클릭·버튼): 제목, 하루 종일/시간, 시작~끝, 메모
- 상세 팝업: 제목·기간·메모·만든 사람, canEdit면 수정·삭제, 근태 일정은 근태 화면 안내

## 테스트
- `scripts/checkCalendar.js`(Google 가짜): 검증, 저장 형태(끝 +1, timeZone, 만든 사람), 권한 조합, 조회 필드·kind·canEdit, 범위
- vitest `lib/schedule.ts`: 일정 → 날짜 칸, 폼 검사·요청 데이터
