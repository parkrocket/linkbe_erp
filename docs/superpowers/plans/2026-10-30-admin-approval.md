# 관리자 기능 1단계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 권한(member/admin)·상태(pending/approved/rejected/inactive)를 도입하고, 승인 기반 회원가입과 관리자 화면(가입 승인·직원 관리)을 만든다.

**Architecture:** `lk_user`에 `user_role`·`user_status` 컬럼을 추가한다. 로그인·`requireAuth`·Slack 근태 신청이 상태를 검사하고, `/api/admin/*`은 `requireAdmin`이 보호한다. hibye-web에 `/register`와 `/admin`을 추가한다.

**Tech Stack:** Express(nodejs-server, CommonJS, mysql2), Next.js 16 + TS(hibye-web), vitest, Slack Web API

**Spec:** `docs/superpowers/specs/2026-10-30-admin-approval-design.md`

## Global Constraints
- 공개 저장소: 코드·주석·커밋·마이그레이션 파일에 관리자 이메일 등 개인정보 금지. 첫 관리자 지정은 사용자가 서버에서 실행
- 사용자 식별은 토큰 주인(`req.userId`). 요청 바디의 사용자 값 신뢰 금지
- 응답에 사용자 행을 낼 때 `utils/safeUser.js`의 `toSafeUser`로 비밀번호 해시 제거
- 로그인 실패 형식 유지: `200 { loginSuccess:false, error:<사유> }`
- 관리자 알림 채널: `#hibye-관리`, 관리자 페이지 링크 `https://hibye.kr/admin`
- 비밀번호 규칙(기존 동일): `/^(?=.*[A-Za-z])(?=.*\d|.*[\p{P}\p{S}])[A-Za-z\d\p{P}\p{S}]{8,15}$/u`
- 점검 스크립트는 DB·Slack 가짜. Slack 클라이언트는 `require.cache` 교체 + 토큰 무력화(직접 대입은 무시됨)
- nodejs-server 들여쓰기 4칸, hibye-web는 `.prettierrc` 기준 4칸. 한국어 주석

## Review Focus
1. 상태 컬럼이 아직 없는 DB에 서버가 먼저 배포되면 로그인 전체가 깨짐 → Task 1이 운영 컬럼 존재를 확인한 뒤에만 Task 2 이후 배포 (Task 9 순서)
2. 비활성화된 사용자가 이미 받은 토큰으로 계속 접근 → Task 2 `requireAuth` 테스트 "inactive면 401"
3. 관리자가 마지막 관리자 자신을 해제·비활성화해 관리자 0명 → Task 4 테스트 "Last admin", "Cannot change yourself"
4. 같은 이메일 대소문자 차이(`A@x.com` vs `a@x.com`)로 중복 가입 → Task 3에서 이메일 소문자·trim 정규화 후 저장·중복 검사, 테스트 포함
5. 다른 회사 직원을 관리자 API로 변경 → Task 4 테스트 "다른 회사 대상 404"

---

## File Structure
```
nodejs-server/
  migrations/2026-10-30-user-role-status.sql   컬럼 추가 (관리자 지정 제외)
  src/middlewares/requireAuth.js               상태 확인 + req.userRole (수정)
  src/middlewares/requireAdmin.js              관리자 전용 (신규)
  src/utils/registerValidation.js              가입 입력 검증·정규화 (신규)
  src/controllers/userController.js            login 상태 검사, register 재작성 (수정)
  src/models/userModel.js                      create(pending), findStatusById (수정)
  src/models/adminModel.js                     직원 목록·요약·상태/권한 변경 (신규)
  src/controllers/adminController.js           전이 규칙·안전장치·Slack 기록 (신규)
  src/routes/admin.js, src/index.js            /api/admin 연결 (신규/수정)
  src/models/applyModel.js                     신청자 상태 검사 (수정)
  scripts/checkLoginStatus.js, checkRegister.js, checkAdmin.js   (신규), checkApply.js (수정)
hibye-web/src/
  lib/types.ts                                 User에 user_role·user_status (수정)
  lib/authMessages.ts(+test)                   로그인·가입 사유 → 문구 (신규)
  lib/register.ts(+test)                       가입 클라이언트 검증 (신규)
  app/(public)/login/LoginForm.tsx             사유별 문구 (수정)
  app/(public)/register/page.tsx, RegisterForm.tsx   (신규)
  app/(member)/admin/page.tsx                  관리자 확인 + AdminPage (신규)
  components/admin/AdminPage.tsx, PendingTab.tsx, MembersTab.tsx, adminApi.ts   (신규)
  components/layout/Header.tsx, HeaderView.tsx '관리' 메뉴 + 배지 (수정)
  proxy.ts                                     /admin 보호 (수정)
```

---

### Task 1: DB 마이그레이션 (운영 반영은 사용자 실행)

**Files:** Create `nodejs-server/migrations/2026-10-30-user-role-status.sql`

- [ ] **Step 1: SQL 작성**
```sql
-- lk_user 권한·상태 추가 (기존 행은 기본값으로 member / approved)
ALTER TABLE lk_user
    ADD COLUMN user_role VARCHAR(20) NOT NULL DEFAULT 'member',
    ADD COLUMN user_status VARCHAR(20) NOT NULL DEFAULT 'approved';
-- 되돌리기: ALTER TABLE lk_user DROP COLUMN user_role, DROP COLUMN user_status;
```
- [ ] **Step 2: 사용자에게 서버 실행 명령 안내** (백업 → 적용 → 첫 관리자 지정 → 확인). SQL 파일은 코드 배포 전이라 서버에 없으므로 명령에 직접 넣음. DB 이름은 서버 `.env.production`에서 읽고, 관리자 이메일은 `read`로 입력받아 명령 기록에 남기지 않음:
```bash
DB=$(grep '^DB_DATABASE=' ~/nodejs-server/.env.production | cut -d= -f2)
sudo mysqldump "$DB" lk_user > ~/lk_user-backup-20261030.sql && ls -l ~/lk_user-backup-20261030.sql
sudo mysql "$DB" -e "ALTER TABLE lk_user ADD COLUMN user_role VARCHAR(20) NOT NULL DEFAULT 'member', ADD COLUMN user_status VARCHAR(20) NOT NULL DEFAULT 'approved'"
read -p "관리자 이메일: " A; sudo mysql "$DB" -e "UPDATE lk_user SET user_role='admin' WHERE user_id='$A'"; unset A
sudo mysql "$DB" -e "SELECT user_role, user_status, COUNT(*) FROM lk_user GROUP BY 1,2"
```
Expected: `admin approved 1`, `member approved 6`
- [ ] **Step 3: 로컬(터널)에서 컬럼 확인** — `SHOW COLUMNS FROM lk_user`에 두 컬럼 존재. 이 확인 전에는 Task 2 이후를 운영에 배포하지 않음
- [ ] **Step 4: 커밋** `chore: lk_user 권한·상태 컬럼 마이그레이션 추가`

---

### Task 2: 로그인·requireAuth 상태 검사, requireAdmin

**Files:** Modify `userController.js`(login), `requireAuth.js`, `userModel.js`; Create `requireAdmin.js`, `scripts/checkLoginStatus.js`

**Interfaces:**
- Produces: `User.findStatusById(userId) => Promise<{ user_status, user_role, cp_id } | undefined>` (SELECT user_status, user_role, cp_id FROM lk_user WHERE user_id = ?)
- `requireAuth`: 토큰 검증 후 `findStatusById` → 없음·`approved` 아님 → `401 { isAuth:false, error:'Account not active' }`; 통과 시 `req.userId`, `req.userRole`, `req.userCpId`
- `requireAdmin(req,res,next)`: `req.userRole !== 'admin'` → `403 { error:'Admin only' }` (requireAuth 뒤에 사용)
- 로그인 사유: `pending`→`Pending approval`, `rejected`→`Registration rejected`, `inactive`→`Account inactive`

- [ ] **Step 1: 실패 테스트** `checkLoginStatus.js` (db.query·bcrypt 비교를 가짜로)
  - status `pending`/`rejected`/`inactive` 로그인 → `200`, `loginSuccess:false`, 해당 `error`, `res.cookie` 미호출
  - `approved` 로그인 → `loginSuccess:true`, 쿠키 설정
  - requireAuth: 유효 토큰 + `inactive` → 401 `Account not active`; 사용자 없음 → 401; `approved` → next, `req.userRole` 설정
  - requireAdmin: member → 403, admin → next
- [ ] **Step 2: 실행해 실패 확인** `node scripts/checkLoginStatus.js`
- [ ] **Step 3: 구현** (공개 경로는 상태 조회 없이 통과 — 기존 PUBLIC_PATHS 유지)
- [ ] **Step 4: 통과 + 기존 점검** `checkLoginStatus`, `checkAuth`, `checkApply`, `checkSlackApply` 모두 ✅ (로컬 DB에 컬럼이 있어야 checkAuth 통과 — Task 1 Step 3 이후)
- [ ] **Step 5: 커밋** `feat: 로그인·API 접근 시 계정 상태 확인, 관리자 전용 미들웨어`

---

### Task 3: 회원가입 API

**Files:** Create `utils/registerValidation.js`, `scripts/checkRegister.js`; Modify `userController.register`, `userModel.create`

**Interfaces:**
- `validateRegister(body) => { ok:true, value:{ email, password, name, phone, cpId } } | { ok:false, error }` — email은 `trim().toLowerCase()`, 오류 문자열은 스펙 4장 그대로(`Invalid email` 등), phone `/^[0-9-]{10,13}$/`, cpId는 양의 정수
- `User.create({ email, password, name, phone, cpId }) => Promise<insertId>` — `user_status='pending'`, `user_role='member'` 명시
- register: 검증 → `lk_company`에 cpId 존재 확인(없으면 400 `Invalid company`) → 기존 사용자 조회(`rejected`면 409 `Registration rejected`, 그 외 존재 409 `Email already registered`) → create → `sendSlackMessage('#hibye-관리', '{이름}님이 가입 승인을 기다리고 있어요 → https://hibye.kr/admin')` → `200 { registerSuccess:true }` (사용자 정보 응답 안 함)

- [ ] **Step 1: 실패 테스트** `checkRegister.js`
  - 이메일 형식·비밀번호 7자·영문 없음·이름 공백·전화 형식·회사 없음 → 각 400 사유
  - `'  A@Linkbe.KR '` → 저장 이메일 `a@linkbe.kr` (Review Focus 4), 기존 `a@linkbe.kr` 존재 시 409 `Email already registered`
  - 기존 rejected → 409 `Registration rejected`
  - 성공 → INSERT 파라미터에 `'pending'`, Slack 알림 1회(본문에 이름·`https://hibye.kr/admin`), 응답에 `user`/비밀번호 없음
  - 검증 실패 시 Slack 알림 0회
- [ ] **Step 2: 실패 확인** → **Step 3: 구현** → **Step 4: 통과 확인** (기존 점검 포함)
- [ ] **Step 5: 커밋** `feat: 회원가입 서버 검증, 승인 대기 저장, 관리자 알림`

---

### Task 4: 관리자 API

**Files:** Create `models/adminModel.js`, `controllers/adminController.js`, `routes/admin.js`, `scripts/checkAdmin.js`; Modify `index.js` (`app.use('/api/admin', requireAdmin, adminRoutes)` — `/api` requireAuth 뒤)

**Interfaces:**
- `Admin.listUsers(cpId, status?) => rows` (컬럼: mb_no, user_id, user_name, user_phone, user_role, user_status, user_datetime; 최신 가입순)
- `Admin.pendingCount(cpId) => number`
- `Admin.findByMbNo(cpId, mbNo) => row | undefined`, `Admin.countApprovedAdmins(cpId) => number`
- `Admin.updateStatus(mbNo, status)`, `Admin.updateRole(mbNo, role)`
- 허용 전이: `{ pending:['approved','rejected'], approved:['inactive'], inactive:['approved'], rejected:['approved'] }` — 그 외 400 `Invalid transition`
- 라우트: `GET /users?status=`, `GET /summary` → `{ pendingCount }`, `POST /users/:mbNo/status {status}`, `POST /users/:mbNo/role {role}` (role은 member/admin만, 아니면 400 `Invalid role`)
- 성공 시 `sendSlackMessage('#hibye-관리', '{관리자 이름}님이 {대상 이름}님을 {동작}했어요')` — 동작: 승인/거절/비활성화/다시 활성화/관리자로 지정/관리자 해제

- [ ] **Step 1: 실패 테스트** `checkAdmin.js`
  - 다른 회사 mbNo → 404 (Review Focus 5)
  - pending→approved 200 + 알림, approved→rejected 400 `Invalid transition`
  - 자기 자신 inactive·role member → 409 `Cannot change yourself` (Review Focus 3)
  - 승인 관리자 1명일 때 그 관리자 해제·비활성 → 409 `Last admin` (자기 자신이 아닌 대상 상황으로도 검증)
  - role `owner` → 400; 목록 응답에 `user_password` 없음
  - 실패 시 알림 0회
- [ ] **Step 2–4: 실패 확인 → 구현 → 통과(기존 점검 포함)**
- [ ] **Step 5: 커밋** `feat: 관리자 API(직원 목록·가입 승인·상태·권한 변경)`

---

### Task 5: Slack·웹 근태 신청 — 승인된 사용자만

**Files:** Modify `models/applyModel.js`(insertMany 사용자 조회에 `user_status` 추가), `controllers/slackController.js`(SLACK_LEAVE_ERRORS), `scripts/checkApply.js`, `scripts/checkSlackApply.js`

- [ ] **Step 1: 실패 테스트** — checkApply: 사용자 `user_status:'inactive'` → 403 `Account not approved`, 캘린더 호출 없음; checkSlackApply: 사유 `Account not approved` → `input_c`에 "승인된 계정만" 포함
- [ ] **Step 2–4** → **Step 5: 커밋** `fix: 승인되지 않은 계정의 근태 신청 차단`

---

### Task 6: hibye-web 로그인 사유 안내

**Files:** Modify `lib/types.ts`(`user_role?: 'member' | 'admin'`, `user_status?: string`), `LoginForm.tsx`; Create `lib/authMessages.ts`, `lib/authMessages.test.ts`

**Interfaces:** `loginErrorMessage(reason?: string) => string` — `Pending approval`→"가입 승인을 기다리고 있어요. 승인 후 로그인할 수 있어요.", `Registration rejected`→"가입이 승인되지 않았어요. 관리자에게 문의해 주세요.", `Account inactive`→"비활성화된 계정이에요. 관리자에게 문의해 주세요.", 그 외→"이메일 또는 비밀번호를 확인해 주세요."

- [ ] **Step 1–4: 테스트(4가지 문구) → 실패 → 구현(LoginForm이 `res.error`를 사용) → 통과**
- [ ] **Step 5: 커밋** `feat: 로그인 실패 사유별 안내(승인 대기·거절·비활성)`

---

### Task 7: hibye-web 회원가입 화면

**Files:** Create `lib/register.ts`(+test), `app/(public)/register/page.tsx`, `RegisterForm.tsx`; Modify `lib/authMessages.ts`(`registerErrorMessage`)

**Interfaces:**
- `validateRegisterForm(form) => Partial<Record<'email'|'password'|'passwordConfirm'|'name'|'phone'|'agree', string>>` — 서버와 같은 규칙, 필드별 한국어 메시지, 동의 미체크 시 `agree`
- `registerErrorMessage(reason)` — `Email already registered`→"이미 가입된 이메일이에요.", `Registration rejected`→"가입이 승인되지 않은 이메일이에요. 관리자에게 문의해 주세요.", 400 사유→"입력한 내용을 확인해 주세요."
- 화면: `company/list`가 1개면 자동 선택(선택 칸 숨김), 여러 개면 select. 동의 문구는 스펙 초안. 성공 시 같은 페이지에서 완료 상태 + [로그인 화면으로]. 대표색 버튼 1개.

- [ ] **Step 1–4: 테스트(형식·규칙·확인 불일치·동의) → 실패 → 구현 → 통과**
- [ ] **Step 5: 화면 확인** — 임시 미리보기 없이 실제 `/register`(공개)를 browser-automation으로 PC·모바일 캡처, 빈 제출 시 필드별 오류, 콘솔 오류 0. 실제 제출은 하지 않음(운영 DB에 pending 생성됨)
- [ ] **Step 6: 커밋** `feat: hibye-web 회원가입 화면`

---

### Task 8: hibye-web 관리자 화면 + 헤더 메뉴

**Files:** Create `app/(member)/admin/page.tsx`, `components/admin/{AdminPage,PendingTab,MembersTab,adminApi}.tsx|ts`(+`adminApi`의 사유 문구 테스트 `lib/authMessages.test.ts`에 추가); Modify `proxy.ts`(matcher에 `'/admin/:path*'`, `'/admin'`), `Header.tsx`(admin이면 summary 조회해 `pendingCount` 전달), `HeaderView.tsx`(admin에게 '관리' 메뉴 + 숫자 배지)

**Interfaces:**
- `adminErrorMessage(reason)` — `Cannot change yourself`→"자기 자신은 변경할 수 없어요.", `Last admin`→"관리자는 최소 1명 있어야 해요.", `Invalid transition`→"지금 상태에서는 할 수 없는 작업이에요.", 403→"관리자만 할 수 있어요."
- page: 서버에서 `getCurrentUser()`; 비로그인 → `/login?redirect=/admin`, `user_role !== 'admin'` → `redirect('/')`
- 탭: 가입 승인(pending 목록, [승인]/[거절](확인 창)), 직원 관리(상태 필터, 상태·권한 배지 색+글자, 행별 버튼 — 자기 자신 행은 비활성화·관리자 해제 버튼 disabled + 이유 툴팁). 변경 후 목록·헤더 배지 갱신(`router.refresh()`)
- 기존 `Modal`, `Badge`, `Card`, `useApiData`(GET 지원 필요 시 method 인자 추가) 재사용

- [ ] **Step 1–4: 문구 테스트 → 실패 → 구현 → 통과, typecheck·lint·build**
- [ ] **Step 5: 화면 확인** — 비관리자·비로그인 접근 시 이동 확인(curl/브라우저). 관리자 화면 캡처는 사용자 로그인 필요 → 사용자 확인 단계로
- [ ] **Step 6: 커밋** `feat: hibye-web 관리자 화면(가입 승인·직원 관리)과 헤더 관리 메뉴`

---

### Task 9: 운영 반영과 확인

- [ ] **Step 1:** Task 1 Step 2를 사용자가 서버에서 실행 → 결과 `admin approved 1 / member approved 6` 확인
- [ ] **Step 2:** push → nodejs-server·hibye-web 배포 `success`, `checkAuth https://hibye.kr/node` ✅
- [ ] **Step 3:** 사용자에게 `#hibye-관리`에 봇 초대 요청, 확인 시나리오 안내: 시크릿 창에서 테스트 계정 가입 → Slack 알림 → 관리자 로그인 → 승인 → 테스트 계정 로그인 → 관리자가 비활성화 → 테스트 계정 다음 요청 차단
- [ ] **Step 4:** CLAUDE.local.md 갱신
