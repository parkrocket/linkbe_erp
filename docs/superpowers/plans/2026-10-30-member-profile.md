# 직원 상세 팝업 + 인사 정보 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 직원 관리 탭 팝업에서 인사 정보(이름·연락처·입사일·성별·생년월일·부서·직급·고용형태·잔여)를 열람·수정하고, 부서·직급 목록을 관리하며, 가입 때 입사일·성별·생년월일을 받는다.

**Architecture:** lk_user에 칸 추가 + lk_department/lk_position(회사별). 관리자 API는 명시 컬럼·회사 범위. 잔여 수정은 2단계 `POST /balances` 재사용. 개인정보 칸은 공용 `toSafeUser`에서 제거해 직원용 응답에 새지 않게.

**Tech Stack:** Express + mysql2, Next.js 16 + TS + Tailwind 4, vitest, assert 점검 스크립트

**Spec:** `docs/superpowers/specs/2026-10-30-member-profile-design.md`

## Global Constraints

- 들여쓰기 4칸, 작은따옴표, 세미콜론, 한국어 주석, 커밋 `타입: 내용` + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 새 TSX는 `prettier --print-width 140`
- 공개 저장소: 개인정보 금지. Slack 기록에 생년월일 등 값 금지, 이름은 `escapeSlack`
- 관리자 API는 항상 `req.userCpId` 범위, 명시 컬럼(SELECT * 금지)
- push는 사용자가 마이그레이션 실행 후 승인할 때만 (Task 1은 마이그레이션 무관 — 먼저 배포 가능)
- 날짜 규칙: `YYYY-MM-DD` 실존 날짜, birth `1900-01-01 ≤ x ≤ 오늘(KST)`, doe `1900-01-01 ≤ x ≤ 오늘+365일(KST)`
- 코드값: gender `male|female`, employmentType `regular|contract|intern|freelance`
- 오류 사유: `Invalid name|phone|doe|birth|gender|employment type|department|position`, 조직 `Duplicate name`(409) `In use`(409) `Not found`(404)

## Review Focus

1. 새 개인정보 칸이 직원용 응답(`/list/*`, `/gtw/*`, `/vacation/list`, `/users/auth`)에 실려 나감 → `toSafeUser`가 제거 — Task 1 테스트
2. 다른 회사의 부서·직급 id를 프로필에 지정 → `Invalid department/position` — Task 3 테스트
3. 존재하지 않는 날짜(2026-02-30), 오늘 경계(KST 자정 직후) — Task 2 테스트
4. 조직 `kind`에 임의 문자열(테이블명 주입) → 404 — Task 4 테스트
5. 팝업에서 목록에 없는 dept_id(삭제 경쟁) → '선택 안 함'으로 표시되고 저장 시 null — Task 5 테스트(`toProfileForm`)

---

### Task 1: 직원용 응답에서 민감 칸 제거 (기존 보안 결함)

**Files:** Modify `nodejs-server/src/utils/safeUser.js`, `nodejs-server/src/controllers/listController.js`; Test `nodejs-server/scripts/checkSafeUser.js`

- [ ] Step 1: 실패 테스트 — `toSafeUser`가 `user_password, user_birth, user_gender, calendar_token`을 제거, 나머지 유지. `listController.lists`·`listsMember`(List 모델 가짜)가 행마다 `user_password`·`user_birth` 없음
- [ ] Step 2: `node scripts/checkSafeUser.js` → FAIL
- [ ] Step 3: `toSafeUser`에 제거 목록(상수) 적용, listController 두 응답에 `list.map(toSafeUser)`
- [ ] Step 4: checkSafeUser·checkVacationList·checkTeamStatus·checkLoginStatus ✅
- [ ] Step 5: 커밋 `fix: 근무기록 목록 API에서 비밀번호 해시·개인정보 제거`

### Task 2: 마이그레이션·검증·회원가입 필수 항목

**Files:** Create `nodejs-server/migrations/2026-10-30-member-profile.sql`, `nodejs-server/src/utils/profileValidation.js`; Modify `utils/registerValidation.js`, `models/userModel.js`(`User.create`); Test `scripts/checkProfile.js`(검증 부분), `scripts/checkRegister.js`

**Interfaces — Produces:**
- `profileRules`: `isDateIn(value, min, max)`, `kstToday()`, `addDays(date, n)`, `NAME_MAX=50`, `PHONE_RULE`
- `validateProfile(body) → { error } | { value: { name, phone, doe, gender, birth, deptId, positionId, employmentType } }` (doe·birth·gender·deptId·positionId·employmentType은 null 허용)
- `validateRegister` value에 `doe, gender, birth` 추가(필수), `User.create`가 `user_doe, user_gender, user_birth` 저장

- [ ] Step 1: 마이그레이션 — 스펙 2장 그대로 (ALTER lk_user 5칸 + CREATE lk_department/lk_position, UNIQUE(cp_id,name)), 되돌리기 주석
- [ ] Step 2: 실패 테스트 — checkProfile: 각 사유, 경계(birth 1900-01-01·오늘 통과, 1899-12-31·내일 실패, doe 오늘+365 통과·+366 실패, 2026-02-30 실패), null 허용, name trim, 정상 value. checkRegister: doe/gender/birth 누락·형식 오류 → 각 사유, 정상 시 `User.create`에 세 값 전달. 오늘은 `Date` 고정 가능하게 `kstToday(now)` 인자
- [ ] Step 3: 실행 → FAIL
- [ ] Step 4: 구현 (registerValidation은 profileValidation의 규칙 재사용)
- [ ] Step 5: 두 스크립트 ✅, 커밋 `feat: 인사 정보 칸 마이그레이션·검증, 회원가입 입사일·성별·생년월일 필수`

### Task 3: 직원 상세·프로필 수정 API

**Files:** Modify `models/adminModel.js`, `controllers/adminController.js`, `routes/admin.js`; Test `scripts/checkProfile.js`(API 부분), `scripts/checkAdminModel.js`, `scripts/checkAuth.js`

**Interfaces — Produces:**
- `Admin.findDetail(cpId, mbNo) → row | undefined` (스펙 3.2 컬럼, 날짜 `DATE_FORMAT '%Y-%m-%d'`)
- `Admin.updateProfile(cpId, mbNo, value) → Promise` (`WHERE mb_no = ? AND cp_id = ?`)
- `Org.exists(cpId, kind, id) → boolean` (Task 4가 구현 — 이 Task에서 먼저 `models/orgModel.js`에 exists만 만들고 Task 4가 확장)
- HTTP `GET /api/admin/users/:mbNo` → `{ user }`, `POST /api/admin/users/:mbNo/profile` → `{ ok: true }`

- [ ] Step 1: 실패 테스트 — 상세: 다른 회사 404, 응답에 user_password 없음. 수정: 검증 실패 400, 다른 회사 부서 id → 400 `Invalid department`, 바뀐 항목만 비교해 없으면 UPDATE 없이 ok, 있으면 UPDATE 1회 + Slack `관리자님이 김직원님 정보를 수정했어요 (이름·부서)`(값 없음), Slack 실패해도 200, 본인 수정 허용. checkAdminModel: findDetail·updateProfile 회사 조건·SELECT * 금지. checkAuth: `GET /api/admin/users/1` 무인증 401
- [ ] Step 2: FAIL 확인
- [ ] Step 3: 구현 — 항목 이름 표 `{ name:'이름', phone:'연락처', doe:'입사일', gender:'성별', birth:'생년월일', deptId:'부서', positionId:'직급', employmentType:'고용형태' }`
- [ ] Step 4: ✅ (checkAuth는 로컬 5000 재시작 후 — 마이그레이션 전이면 상세는 컬럼 없음으로 500이지만 checkAuth는 401만 봄)
- [ ] Step 5: 커밋 `feat: 관리자 직원 상세 조회·인사 정보 수정 API`

### Task 4: 조직(부서·직급) API

**Files:** Modify `models/orgModel.js`, `controllers/adminController.js`, `routes/admin.js`; Test `scripts/checkOrg.js`, `scripts/checkAuth.js`

**Interfaces — Produces:** `GET /api/admin/org`, `POST /api/admin/org/:kind`, `POST /api/admin/org/:kind/:id`, `POST /api/admin/org/:kind/:id/move`, `DELETE /api/admin/org/:kind/:id` (스펙 3.2). `kind` 표 `{ departments: { table: 'lk_department', column: 'dept_id' }, positions: { table: 'lk_position', column: 'position_id' } }`

- [ ] Step 1: 실패 테스트(가짜 pool) — 목록 회사 범위·member_count(같은 회사 approved 외 포함 전체 소속), 생성 trim·1~50자·ER_DUP_ENTRY → 409, 이름 변경 다른 회사 404, move up 맨 위면 변화 없음·이웃과 교환(트랜잭션), 삭제 사용 중 409·미사용 DELETE, kind `lk_user` → 404. checkAuth `GET /api/admin/org` 401
- [ ] Step 2: FAIL → Step 3 구현 → Step 4 ✅
- [ ] Step 5: 커밋 `feat: 관리자 부서·직급 목록 관리 API`

### Task 5: hibye-web 순수 함수·API

**Files:** Create `hibye-web/src/lib/profile.ts`(+test); Modify `lib/register.ts`(+test), `lib/authMessages.ts`(+test), `components/admin/adminApi.ts`

**Interfaces — Produces:**
- `GENDER_LABEL`, `EMPLOYMENT_LABEL`, `type MemberDetail`, `type ProfileForm`(모두 문자열, 빈 문자열=선택 안 함), `toProfileForm(user, deptIds, positionIds)`(목록에 없는 id → ''), `toProfilePayload(form)`(''→null, id→number), `validateProfileForm(form) → Partial<Record<keyof ProfileForm,string>>`
- register: `RegisterForm`에 `doe, gender, birth`, 오류 문구 `입사일을 확인해 주세요.` `성별을 선택해 주세요.` `생년월일을 확인해 주세요.`
- adminErrorMessage: `Duplicate name`→`이미 있는 이름이에요.`, `In use`→`소속 직원이 있어 삭제할 수 없어요. 이름 변경만 가능해요.`, `Invalid department`/`Invalid position`→`부서·직급 목록이 바뀌었어요. 새로고침 후 다시 선택해 주세요.`, 그 외 `Invalid …` 프로필 사유 → `입력값을 확인해 주세요.`
- adminApi: `fetchMember`, `saveProfile`, `org` 함수들

- [ ] Step 1 테스트 → Step 2 FAIL → Step 3 구현 → Step 4 `npm test && npm run typecheck` ✅ → Step 5 커밋 `feat: hibye-web 인사 정보 폼 변환·검사`

### Task 6: 화면 — 직원 팝업·조직 탭·회원가입

**Files:** Create `components/admin/MemberDialog.tsx`, `components/admin/OrgTab.tsx`; Modify `MembersTab.tsx`, `AdminPage.tsx`, `app/(public)/register/RegisterForm.tsx`

- [ ] Step 1: MemberDialog — 스펙 4장. 상세·조직 목록 병렬 로드, 저장 후 목록 reload. 잔여 영역은 `saveBalances(reason, [단일 change])`
- [ ] Step 2: MembersTab 행 이름 영역을 `button`으로(키보드 접근), AdminPage에 `조직` 탭
- [ ] Step 3: OrgTab — 두 목록, 추가·이름 수정·▲▼·삭제(사용 중이면 안내)
- [ ] Step 4: RegisterForm — 입사일·생년월일 `type=date`, 성별 라디오, 동의 문구 수집 항목 `이메일·이름·휴대폰 번호·생년월일·성별·입사일`
- [ ] Step 5: `npm test && npm run typecheck && npm run lint && npm run build` ✅, 커밋 `feat: hibye-web 직원 상세 팝업·조직 탭·회원가입 인사 정보`

### Task 7: 문서·운영 반영

- [ ] CLAUDE.md·CLAUDE.local.md 갱신(민감정보 grep), 커밋은 CLAUDE.local.md 제외 문서만
- [ ] [사용자] 운영 DB 마이그레이션 → [사용자] 로컬 확인 → 승인 후 push → Actions·checkAuth 운영
