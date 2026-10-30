# 관리자 2단계: 연차·휴가 조정 + 잔여 장부 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 직원 연차·휴가를 표에서 일괄 덮어쓰고, 잔여가 바뀌는 모든 경우(관리자 조정·신청·취소)를 `lk_balance_log`에 남긴다.

**Architecture:** 장부 INSERT는 잔여를 바꾸는 트랜잭션 안에서 같은 연결로 실행(실패 시 전체 롤백). 관리자 조정은 `expected` 값 비교로 동시 변경을 막는다. 화면은 `/admin`의 세 번째 탭이 자체 데이터를 불러온다.

**Tech Stack:** Express + mysql2(promise pool), Next.js 16 + TS + Tailwind 4, vitest, assert 점검 스크립트

**Spec:** `docs/superpowers/specs/2026-10-30-balance-ledger-design.md`

## Global Constraints

- 들여쓰기 4칸, 작은따옴표, 세미콜론, 한국어 주석, 커밋 `타입: 내용` + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- 공개 저장소: 커밋·문서에 개인정보·내부 수치 금지
- 사용자 입력을 Slack에 넣을 때 `escapeSlack`
- 관리자 API는 항상 `req.userCpId` 범위
- 커밋은 master 로컬 커밋까지. **push(=운영 배포)는 Task 6에서 사용자가 테이블을 만든 뒤에만**
- 검증 값: 연차 `0~365, 0.5 단위` / 휴가 `0~365 정수` / 사유 trim 후 `1~200자` / changes `1~200개, mbNo 중복 불가`
- 오류 사유 문자열: `Invalid reason`, `Invalid changes`, `Invalid balance`, `No changes`, `User not found`(404), `Balance changed`(409)

## Review Focus

1. 31일 한꺼번에 신청 시 자동 메모가 200자 초과 → VARCHAR(200) 오류로 신청 자체가 실패하면 안 됨 (메모는 `BalanceLog.insert`가 200자로 자름) — Task 1 테스트
2. 잔여가 NULL인 직원(`user_stip`/`user_vaca` NULLABLE) — 조정 시 expected `null`과 일치로 판정, 장부 before는 null — Task 3 테스트
3. 문자열 숫자(`"15"`)나 `NaN`/`Infinity`가 바디로 옴 → `Invalid balance` — Task 3 테스트
4. 다른 회사 직원 mbNo가 섞인 일괄 조정 → 전체 404, 아무것도 바뀌지 않음 — Task 3 테스트
5. Slack 전송 실패가 이미 커밋된 조정을 500으로 보이게 하면 안 됨 — Task 3 테스트

---

### Task 1: 장부 테이블·모델

**Files:**
- Create: `nodejs-server/migrations/2026-10-30-balance-log.sql`
- Create: `nodejs-server/src/models/balanceLog.js`
- Test: `nodejs-server/scripts/checkBalanceLog.js`

**Interfaces:**
- Produces:
  - `BalanceLog.insert(conn, { cpId, mbNo, actorMbNo, kind, before: { stip, vaca }, after: { stip, vaca }, memo }) → Promise<void>` — `conn.query`로 INSERT, memo는 200자 초과 시 앞 199자 + `…`
  - `BalanceLog.listByMember(cpId, mbNo, limit = 100) → Promise<Row[]>` — 컬럼 `id, kind, stip_before, stip_after, vaca_before, vaca_after, memo, created_at, actor_name`(`LEFT JOIN lk_user a ON a.mb_no = l.actor_mb_no`), `WHERE l.cp_id = ? AND l.mb_no = ? ORDER BY l.id DESC LIMIT ?`

- [ ] **Step 1: 마이그레이션 작성** — 스펙 2장 컬럼·타입 그대로 `CREATE TABLE lk_balance_log (...) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, `INDEX idx_member (cp_id, mb_no, id)`. 파일 끝에 `-- 되돌리기: DROP TABLE lk_balance_log;` (1단계 마이그레이션 파일 형식)
- [ ] **Step 2: 실패 테스트** — `checkAdminModel.js`처럼 가짜 `conn`/`pool.query`로 SQL·파라미터만 확인:
  - insert: SQL이 `INSERT INTO lk_balance_log`, 파라미터 순서 `[cpId, mbNo, actorMbNo, kind, stipBefore, stipAfter, vacaBefore, vacaAfter, memo]`, 전달한 `conn`으로 실행(pool 미사용)
  - insert: memo `'가'.repeat(250)` → 길이 200, 끝 `…`
  - listByMember: `cp_id = ?`·`mb_no = ?` 조건, params `[7, 3, 100]`, `SELECT *`·`user_password` 없음
- [ ] **Step 3:** `node scripts/checkBalanceLog.js` → FAIL (모듈 없음)
- [ ] **Step 4:** `models/balanceLog.js` 구현
- [ ] **Step 5:** `node scripts/checkBalanceLog.js` → `checkBalanceLog ✅`
- [ ] **Step 6: 커밋** `feat: 잔여 장부 테이블(lk_balance_log)과 모델`

### Task 2: 신청·취소를 장부에 기록, 우회 함수 삭제

**Files:**
- Modify: `nodejs-server/src/models/applyModel.js` (insertMany, cancel)
- Modify: `nodejs-server/src/models/userModel.js` (`User.stipUpdate` 삭제), `nodejs-server/src/models/vacationModel.js` (`Vca.create`, `Vca.cancel` 삭제 — 호출처 없음 확인됨)
- Test: `nodejs-server/scripts/checkApply.js`, `nodejs-server/scripts/checkSlackApply.js`

**Interfaces:**
- Consumes: `BalanceLog.insert(conn, …)` (Task 1)

- [ ] **Step 1: 실패 테스트** (`checkApply.js`에 추가, 기존 `reset`의 사용자에 `mb_no: 5, cp_id: 1` 추가)
  - 연차 3일(11-18~20) 성공 → `INSERT INTO lk_balance_log` 1회, params `[1, 5, 5, 'apply', 5, 2, 2, 2, '연차 신청 11/18, 11/19, 11/20']`, 장부 INSERT가 COMMIT보다 먼저
  - 반차 → before/after stip `5 → 4.5`, memo `반차 신청 11/03`
  - 휴가 → vaca `2 → 1`, stip 전·후 동일
  - 재택 → 장부 INSERT 0회
  - 장부 INSERT가 Error → 500, ROLLBACK, 만든 캘린더 일정 삭제
  - 취소 반차(`{ id:7, type:'half', calendar_id:'evt-7', md:'11/05' }`) → 사용자 행 `FROM lk_user WHERE user_id = ? FOR UPDATE` 조회, 장부 params `[1, 5, 5, 'cancel', 5, 5.5, 2, 2, '반차 취소 11/05']`
  - 취소 재택 → 장부 0회
- [ ] **Step 2:** `node scripts/checkApply.js` → FAIL (장부 INSERT 없음)
- [ ] **Step 3: 구현**
  - insertMany: 기존 `FOR UPDATE` SELECT에 `mb_no, cp_id` 추가. 차감 UPDATE 직후(재택 제외) `BalanceLog.insert(conn, { cpId, mbNo, actorMbNo: mbNo, kind: 'apply', before, after, memo })`. after는 JS에서 `before - totalDays`(해당 컬럼만). memo `${label} 신청 ${MM/DD 목록 ', ' 연결}`
  - cancel: lk_vacation SELECT에 `DATE_FORMAT(date, '%m/%d') AS md` 추가. 차감 대상 종류면 `SELECT mb_no, cp_id, user_stip, user_vaca FROM lk_user WHERE user_id = ? FOR UPDATE` → 복원 UPDATE → `kind: 'cancel'`, memo `${label} 취소 ${md}`
  - 옛 함수 3개 삭제(각 파일의 나머지 함수는 유지)
- [ ] **Step 4:** `node scripts/checkApply.js && node scripts/checkSlackApply.js` → 둘 다 ✅ (checkSlackApply가 사용자 행 가짜에 mb_no가 없어 깨지면 가짜 데이터에 `mb_no`, `cp_id` 추가)
- [ ] **Step 5:** `grep -rn "stipUpdate\|Vca.create\|Vca.cancel" nodejs-server/src` → 결과 없음
- [ ] **Step 6: 커밋** `feat: 근태 신청·취소 시 잔여 장부 기록, 장부를 우회하는 옛 함수 삭제`

### Task 3: 관리자 조정 API

**Files:**
- Create: `nodejs-server/src/utils/balanceValidation.js`
- Create: `nodejs-server/src/models/balanceModel.js`
- Modify: `nodejs-server/src/controllers/adminController.js`, `nodejs-server/src/routes/admin.js`
- Test: `nodejs-server/scripts/checkBalance.js`(검증·컨트롤러, 모델 가짜), `nodejs-server/scripts/checkBalanceModel.js`(모델, 가짜 연결), `nodejs-server/scripts/checkAuth.js`

**Interfaces:**
- Consumes: `BalanceLog.insert`, `BalanceLog.listByMember` (Task 1)
- Produces (Task 4·5가 쓰는 HTTP):
  - `GET /api/admin/balances` → `{ users: [{ mb_no, user_name, user_id, user_stip, user_vaca }] }` (같은 회사, approved, `ORDER BY user_name`)
  - `POST /api/admin/balances` 바디 `{ reason, changes: [{ mbNo, stip, vaca, expectedStip, expectedVaca }] }` → `{ ok: true, changed: number }`
  - `GET /api/admin/balances/:mbNo/logs` → `{ logs: Row[] }`
- 내부:
  - `validateAdjust(body) → { error } | { reason, changes }` (reason은 trim된 값)
  - `Balance.listApproved(cpId)`, `Balance.adjust({ cpId, actorMbNo, reason, changes }) → Promise<{ changed: number }>` — 실패는 `status` 가진 Error(`BalanceError`)
  - `Balance.exists(cpId, mbNo) → Promise<boolean>`

- [ ] **Step 1: 실패 테스트 `checkBalance.js`** (`checkAdmin.js`의 call·Slack 가짜 방식)
  - validateAdjust: reason `''`/`'   '`/201자 → `Invalid reason`; changes 비배열·`[]`·201개·mbNo 중복 → `Invalid changes`; stip `15.3`, `-1`, `366`, `'15'`, `NaN`, `Infinity` → `Invalid balance`; vaca `1.5` → `Invalid balance`; expectedStip `'2'` → `Invalid balance`, `null` 허용; 정상 → reason trim 반환
  - adjustBalances: 검증 실패 → 400 + 해당 사유, `Balance.adjust` 미호출
  - 성공 → `Balance.adjust`에 `{ cpId: 1, actorMbNo: 1(관리자 mb_no), reason, changes }`, 응답 `{ ok:true, changed:2 }`, Slack `#hibye-관리` 1건 `관리자님이 연차·휴가를 조정했어요 (2명) — 사유: 2027년 연차 부여`, 사유 `<b>` → `&lt;b&gt;`
  - adjust가 `status 409 'Balance changed'` 던짐 → 409 `{ error: 'Balance changed' }`, Slack 없음
  - Slack 전송이 throw → 응답은 200 ok
  - logs: 다른 회사 mbNo → 404 `User not found`, 같은 회사 → `{ logs }`
- [ ] **Step 2: 실패 테스트 `checkBalanceModel.js`** (`checkApply.js`의 가짜 연결 방식)
  - adjust 대상 조회 SQL에 `cp_id = ?`·`mb_no IN (?)`·`FOR UPDATE`
  - 조회 결과가 요청 수보다 적음(다른 회사 섞임) → 404, UPDATE·장부 0회, ROLLBACK
  - DB `user_stip 2.5` vs expectedStip `3` → 409 `Balance changed`, ROLLBACK
  - DB `user_stip null`, expectedStip `null` → 일치로 진행, 장부 before stip `null`
  - stip·vaca 모두 현재값과 같은 항목은 건너뜀, 전부 같으면 400 `No changes`
  - 성공 2명 → `UPDATE lk_user SET user_stip = ?, user_vaca = ? WHERE mb_no = ? AND cp_id = ?` 2회, 장부 `kind 'admin'`, memo=reason 2회, COMMIT 1회, `{ changed: 2 }`
- [ ] **Step 3:** 두 스크립트 실행 → FAIL (모듈 없음)
- [ ] **Step 4: 구현**
  - `adminController`: `handle`이 `error.status`가 있으면 `fail(res, error.status, error.message)`. 핸들러 `listBalances`, `adjustBalances`, `balanceLogs`. 관리자 mb_no·이름은 `Admin.findByUserId(req.userCpId, req.userId)`. Slack은 커밋 후, try/catch로 실패 시 `console.error`만
  - routes: `GET /balances`, `POST /balances`, `GET /balances/:mbNo/logs` (`/:mbNo`는 양의 정수 아니면 404 — 1단계 `loadTarget`과 동일 규칙)
- [ ] **Step 5: `checkAuth.js`** — 무인증 `GET /api/admin/balances` → 401 추가
- [ ] **Step 6:** `node scripts/checkBalance.js && node scripts/checkBalanceModel.js && node scripts/checkAdmin.js && node scripts/checkAuth.js` → 모두 ✅ (checkAuth는 로컬 서버 5000 재시작 후)
- [ ] **Step 7: 커밋** `feat: 관리자 연차·휴가 일괄 조정 API와 변경 이력 조회`

### Task 4: hibye-web 순수 함수·API

**Files:**
- Create: `hibye-web/src/lib/balance.ts`, `hibye-web/src/lib/balance.test.ts`
- Modify: `hibye-web/src/lib/authMessages.ts`, `hibye-web/src/lib/authMessages.test.ts`, `hibye-web/src/components/admin/adminApi.ts`

**Interfaces:**
- Consumes: Task 3 HTTP 형태
- Produces:
  - `type BalanceRow = { mb_no: number; user_name: string; user_id: string; user_stip: number | null; user_vaca: number | null }`
  - `type BalanceDraft = Record<number, { stip?: string; vaca?: string }>` (입력칸 문자열, 키 없음 = 미수정)
  - `validateBalance(kind: 'stip' | 'vaca', value: string): string | null`
  - `diffBalances(rows: BalanceRow[], draft: BalanceDraft): BalanceChange[]` — `BalanceChange = { mbNo; name; stip; vaca; expectedStip; expectedVaca }`, 유효하고 실제로 달라진 행만, 안 바꾼 쪽은 현재값(null이면 0)
  - `type BalanceLogRow`(Task 3 logs 컬럼), `LOG_KIND_LABEL = { admin: '관리자 조정', apply: '신청', cancel: '취소' }`
  - adminApi: `saveBalances(reason: string, changes: BalanceChange[])` (POST, name 필드는 빼고 전송)
- Note: 스펙 4장은 `components/admin/balance.ts`였으나 테스트 파일이 모두 `lib/`에 있어 `lib/balance.ts`로 둠

- [ ] **Step 1: 실패 테스트**
  - validateBalance: `''` → `숫자를 입력해 주세요`; `'abc'`, `'-1'`, `'366'` → `0~365 사이로 입력해 주세요`; stip `'15.3'` → `0.5일 단위로 입력해 주세요`; vaca `'1.5'` → `정수로 입력해 주세요`; stip `'15.5'`, vaca `'3'` → null
  - diffBalances: 값 그대로 입력 → `[]`; stip만 `'15'` → `[{ mbNo, name, stip: 15, vaca: 현재값, expectedStip: 2.5, expectedVaca: 0 }]`; 잘못된 값 행은 제외; 현재값 null 행에 vaca `'3'` → stip 0, expectedStip null
  - adminErrorMessage: `Balance changed` → `그 사이 잔여가 바뀌었어요. 다시 불러온 뒤 입력해 주세요.`; `Invalid reason` → `사유를 1~200자로 입력해 주세요.`; `Invalid balance`/`Invalid changes` → `입력값을 확인해 주세요.`; `No changes` → `바뀐 값이 없어요.`
- [ ] **Step 2:** `cd hibye-web && npm test` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** `npm test && npm run typecheck` → PASS
- [ ] **Step 5: 커밋** `feat: hibye-web 연차·휴가 조정 입력 검사와 변경 계산`

### Task 5: 관리 화면 '연차·휴가' 탭

**Files:**
- Create: `hibye-web/src/components/admin/BalancesTab.tsx`, `hibye-web/src/components/admin/BalanceHistory.tsx`
- Modify: `hibye-web/src/components/admin/AdminPage.tsx`

**Interfaces:**
- Consumes: Task 4 전부, `useApiData`, `Modal`(`components/leave/Modal.tsx`), `Button`, `Badge`, `EmptyState`, `ErrorState`, `Skeleton`, `TextField`

- [ ] **Step 1:** AdminPage — `Tab`에 `'balances'`, 탭 버튼 `연차·휴가`. balances 탭은 `users` 상태와 무관하게 `<BalancesTab />`를 Card 안에 렌더(자체 로딩·오류·안내). 설명 문구 `가입 승인, 직원 계정, 연차·휴가를 관리해요. 모든 조치는 #hibye-관리에 기록돼요.`
- [ ] **Step 2:** BalancesTab — 스펙 4장 그대로
  - `useApiData<{ users?: BalanceRow[] }>('/api/admin/balances', undefined, 'GET')`
  - 표(모바일은 카드형): 이름·아이디 / 연차(`type=number step=0.5 min=0 max=365 inputMode=decimal`) / 휴가(`step=1`) / `이력` 버튼. 바뀐 칸 `border-primary bg-primary-soft`, 오류는 칸 아래 `aria-describedby`
  - 변경 있으면 하단 `sticky bottom-0` 바: `{N}명 변경됨` · 사유 입력(maxLength 200) · `되돌리기` · `저장`(오류 있거나 사유 비면 disabled)
  - 저장 → Modal 확인: 행마다 `{이름}  연차 a → b · 휴가 c → d`(바뀐 쪽만), 사유, `확정`/`취소`
  - 확정 → `saveBalances` 성공: 안내 `{N}명의 연차·휴가를 저장했어요.`, draft·사유 초기화, reload. 실패: `adminErrorMessage`, 사유가 `Balance changed`면 draft 초기화 + reload
- [ ] **Step 3:** BalanceHistory — Modal, `useApiData(`/api/admin/balances/${mbNo}/logs`, undefined, 'GET')`, 최근순 목록 `날짜시각 · LOG_KIND_LABEL · 연차 a→b · 휴가 c→d(바뀐 쪽만) · memo · actor_name`, 빈 목록 `아직 변경 이력이 없어요`
- [ ] **Step 4:** `npm test && npm run typecheck && npm run lint && npm run build` → 모두 통과
- [ ] **Step 5: 로컬 확인** — 3001 시크릿 창: 탭 표시, 입력 강조·오류, 확인 창 목록. **저장은 운영 DB에 테이블이 없으면 실패하므로 Task 6 이후 확인**
- [ ] **Step 6: 커밋** `feat: hibye-web 관리 화면 연차·휴가 탭(일괄 조정·변경 이력)`

### Task 6: 문서·운영 반영 (사용자 단계 포함)

**Files:**
- Modify: `CLAUDE.md`(계정·권한 섹션에 2단계, 테스트 목록에 checkBalanceLog/checkBalance/checkBalanceModel, 근태 규칙에 "잔여 변경은 3곳뿐·장부 필수"), `CLAUDE.local.md`

- [ ] **Step 1:** 문서 갱신 후 민감정보 grep(`@`, IP) → 없음, 커밋 `docs: 관리자 2단계 반영`
- [ ] **Step 2: [사용자]** 운영 서버에서 `lk_balance_log` 생성(1단계와 같은 앱 DB 계정 + 임시 my.cnf 스크립트, `SHOW CREATE TABLE lk_balance_log` 결과 공유)
- [ ] **Step 3:** 사용자 승인 후 push → Actions `success` 확인 → `node nodejs-server/scripts/checkAuth.js https://hibye.kr/node` 통과
- [ ] **Step 4: [사용자]** 운영 확인: Slack 또는 웹으로 테스트 신청·취소 1회 → 관리 화면 이력에 `신청`·`취소` 2줄, 연차·휴가 탭에서 1명 조정 → 이력·#hibye-관리 메시지
