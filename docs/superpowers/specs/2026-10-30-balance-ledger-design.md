# 관리자 기능 2단계: 연차·휴가 일수 조정 + 잔여 장부 — 설계

- 작성일: 2026-10-30
- 상태: 사용자 검토 대기
- 선행: 관리자 기능 1단계(`2026-10-30-admin-approval-design.md`, 운영 배포됨)

## 1. 목표와 결정 사항

관리자가 직원의 남은 연차(`lk_user.user_stip`)·휴가(`user_vaca`)를 화면에서 조정하고, **잔여가 바뀌는 모든 경우**(관리자 조정·근태 신청·근태 취소)를 장부에 남긴다.

사용자 결정:
- 사용 상황: 연초·입사 시 일괄 부여, 값 직접 수정 (가감·자동 계산은 범위 밖)
- 일괄 부여는 **새 값으로 덮어씀** (이월은 관리자가 계산해 입력)
- 화면: 직원 표에서 여러 명을 한꺼번에 수정 → 저장 한 번
- 이력은 **관리자만** 조회, 관리자 조정 시 **사유 필수**, `#hibye-관리`에 기록(저장 1회당 메시지 1개)
- 기록 범위는 B안: 관리자 조정 + 신청 + 취소 모두 (취소 시 `lk_vacation` 행이 삭제되어 기존엔 흔적이 남지 않음)

범위 밖: 근로기준법 기반 자동 부여, 직원 본인 이력 조회, 과거 기록 복원(장부는 배포일부터 쌓임 — 배포일 잔여가 기준점).

## 2. 데이터

새 테이블 `lk_balance_log` (마이그레이션 `nodejs-server/migrations/2026-10-30-balance-log.sql`, 사용자가 운영에서 실행):

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| cp_id | INT NOT NULL | 회사 |
| mb_no | INT NOT NULL | 대상 직원 |
| actor_mb_no | INT NOT NULL | 변경한 사람 (관리자 조정=관리자, 신청·취소=본인) |
| kind | ENUM('admin','apply','cancel') NOT NULL | |
| stip_before / stip_after | FLOAT NULL | 연차 전·후 (`user_stip`와 같은 타입) |
| vaca_before / vaca_after | INT NULL | 휴가 전·후 (`user_vaca`와 같은 타입) |
| memo | VARCHAR(200) NOT NULL | 관리자 조정=입력한 사유, 신청·취소=자동 문구 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |

- 인덱스: `(cp_id, mb_no, id)` — 직원별 최근순 조회
- 한 행 = 한 번의 변경(여러 날 신청도 1행). 바뀌지 않은 쪽 값은 전·후 동일하게 기록
- 재택(차감 없음)은 기록하지 않음
- 자동 문구 예: `연차 신청 11/05, 11/06`, `반차 취소 11/05`

**배포 순서 주의**: 신청·취소가 장부를 같은 트랜잭션에 쓰므로 **테이블 생성 → 코드 배포** 순서를 반드시 지킨다. 반대로 하면 모든 근태 신청이 실패한다.

## 3. 서버

### 3.1 장부 기록 (`models/balanceLog.js`)
- `BalanceLog.insert(conn, { cpId, mbNo, actorMbNo, kind, before, after, memo })` — 호출자의 트랜잭션 연결(`conn`)로 INSERT. 실패하면 호출자 트랜잭션 전체 롤백
- `BalanceLog.listByMember(cpId, mbNo, limit = 100)` — 최근순, 변경한 사람 이름 포함(LEFT JOIN), 같은 회사 조건 필수

### 3.2 신청·취소 연결 (`models/applyModel.js`)
- `insertMany`: 기존 `FOR UPDATE` 조회에 `mb_no, cp_id` 추가 → 차감 UPDATE 뒤 같은 트랜잭션에서 `kind='apply'` 1행 (재택 제외)
- `cancel`: 사용자 행을 `FOR UPDATE`로 읽어 before 확보 → 복원 UPDATE 뒤 `kind='cancel'` 1행 (재택 제외)
- 장부 INSERT 실패 시 기존 실패 처리 그대로(롤백 + 캘린더 일정 정리)

### 3.3 장부 우회 경로 제거
호출처 없는 옛 함수 삭제: `User.stipUpdate`, `Vca.create`, `Vca.cancel`. 잔여를 바꾸는 코드는 `Apply.insertMany`, `Apply.cancel`, 관리자 조정 3곳뿐이 되도록.

### 3.4 관리자 API (`/api/admin`, requireAuth + requireAdmin 뒤, 같은 회사만)

`GET /balances` → `{ users: [{ mb_no, user_name, user_id, user_stip, user_vaca }] }` (승인된 직원만, 이름순)

`POST /balances` 바디:
```json
{ "reason": "2027년 연차 부여",
  "changes": [{ "mbNo": 3, "stip": 15, "vaca": 3, "expectedStip": 2.5, "expectedVaca": 0 }] }
```
- 검증(하나라도 실패하면 전체 400):
  - `reason`: trim 후 1~200자 → `Invalid reason`
  - `changes`: 배열 1~200개, `mbNo` 중복 불가 → `Invalid changes`
  - `stip`: 0~365, 0.5 단위 / `vaca`: 0~365 정수 / expected 값은 숫자 또는 null → `Invalid balance`
- 한 트랜잭션: 대상 행을 `cp_id = ? AND mb_no IN (?) FOR UPDATE`로 조회
  - 없는(다른 회사 포함) 직원 → 404 `User not found`
  - DB 현재값 ≠ expected → 409 `Balance changed` (화면을 연 뒤 신청·취소로 잔여가 바뀐 경우 — 덮어쓰면 그 차감이 사라짐)
  - 현재값과 같은 변경은 건너뜀, 전부 같으면 400 `No changes`
  - UPDATE + `kind='admin'` 장부 행, 커밋
- 관리자 본인 일수도 수정 가능(관리자가 1명이면 막을 경우 본인 연차를 넣을 수 없음 — 장부·Slack에 남음)
- 커밋 후 `#hibye-관리`: `{관리자}님이 연차·휴가를 조정했어요 ({N}명) — 사유: {reason}` (이름·사유 `escapeSlack`). Slack 실패는 응답에 영향 없음(기록만)
- 응답 `{ ok: true, changed: N }`

`GET /balances/:mbNo/logs` → `{ logs: [{ id, kind, stip_before, stip_after, vaca_before, vaca_after, memo, actor_name, created_at }] }` (같은 회사가 아니면 404)

## 4. 화면 (hibye-web `/admin` 세 번째 탭 **연차·휴가**)

- 표: 이름(아이디) / 연차 입력 / 휴가 입력 / 이력 버튼
  - 연차 `step=0.5`, 휴가 `step=1`, 숫자 입력. 바뀐 칸은 강조, 잘못된 값은 칸 아래 이유
- 하나라도 바뀌면 하단 고정 바: `{N}명 변경됨` · 사유 입력 · 되돌리기 · 저장
- 저장 → 확인 창: `홍길동  연차 2.5 → 15 · 휴가 0 → 3` 목록 + 사유 → 확정 시 POST
- 결과: 성공 토스트 후 목록 다시 불러오기. `Balance changed`는 "그 사이 잔여가 바뀌었어요. 다시 불러온 뒤 입력해 주세요" + 다시 불러오기(입력값은 버림)
- 이력 창: 시간순(최근 위) `날짜 · 종류(관리자 조정/신청/취소) · 연차 a→b · 휴가 c→d · 메모 · 변경자`
- 순수 함수(테스트 대상, `components/admin/balance.ts`): 변경 목록 계산 `diffBalances`, 값 검사 `validateBalance`. 오류 문구는 기존 `lib/authMessages.ts`의 `adminErrorMessage`에 새 사유(`Invalid reason`/`Invalid changes`/`Invalid balance`/`No changes`/`Balance changed`)를 추가

## 5. 테스트

- `scripts/checkBalance.js` (DB·Slack 가짜): 회사 범위, 입력 검증 각 사유, expected 불일치 → 409 + 롤백(UPDATE·장부 0건), 같은 값 건너뜀·`No changes`, 장부 행 내용, Slack 요약·이스케이프, 커밋 후 Slack
- `checkApply.js`, `checkSlackApply.js` 보강: 신청·취소 시 장부 1행(전·후 값, kind, memo), 재택은 0행, 장부 INSERT 실패 시 신청 전체 롤백
- `checkAuth.js`: `/api/admin/balances` 무인증 401
- hibye-web vitest: `diffBalances`, `validateBalance`, 오류 문구

## 6. 위험

- 근태 신청 로직 수정 → 기존 점검 + 장부 점검으로 보호, 운영 배포 후 테스트 신청·취소 1회로 장부 확인
- 테이블 없이 코드 배포 시 신청 전면 실패 → 배포 순서 명시(2장), 계획에 확인 단계
- 숫자 덮어쓰기 경쟁 → expected 비교(409)
