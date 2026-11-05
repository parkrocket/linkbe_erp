# 관리자 페이지 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin`을 메뉴별 주소 + 왼쪽 사이드 메뉴 + '처리할 일' 대시보드로 바꾼다.

**Architecture:** Next.js App Router의 `app/(member)/admin/layout.tsx`가 권한 확인 후 `AdminShell`(사이드 메뉴)을 그리고, 메뉴마다 `page.tsx`가 기존 탭 컴포넌트를 그대로 렌더한다. 메뉴 목록·권한·예전 주소 변환은 `lib/adminNav.ts` 한 곳. 새 API는 새 문의 건수 하나.

**Tech Stack:** Next.js 16(App Router, cacheComponents) + TS + Tailwind 4, Express + mysql2, vitest, nodejs-server `scripts/check*.js`

**Spec:** `docs/superpowers/specs/2026-11-05-admin-redesign-design.md`

## Global Constraints
- 코드: 들여쓰기 4칸, 작은따옴표, 세미콜론, 한국어 주석(CLAUDE.md)
- 쿠키를 읽는 서버 컴포넌트는 `<Suspense>` 안(Next 16 cacheComponents)
- 컴포넌트별 스크롤바 스타일 금지(globals.css 전역 규칙)
- 기존 탭 컴포넌트(PendingTab·MembersTab·LeavesTab·BalancesTab·OrgTab·SecretKeyPanel·홈페이지 패널 9개)의 내부 동작은 바꾸지 않음
- 화면 문구는 한국어 해요체, 기존 색 토큰(`primary`, `muted`, `line`, `surface` 등)만 사용
- API 권한은 서버가 다시 검사(requireAdmin·requireHomepage) — 화면 숨김은 편의일 뿐

## Review Focus
1. 홈페이지 권한만 있는 직원이 `/admin`, `/admin/members` 등 관리자 주소를 열 때 → `/admin/homepage/inquiries`로 이동(빈 화면·오류 아님) — Task 2 테스트
2. 예전 링크 `/admin?tab=homepage`·`?tab=members`·`?tab=이상한값` → 각각 새 주소·`/admin` — Task 2 테스트
3. `/admin/homepage/없는메뉴` → 404(`notFound`), 대소문자 다른 값도 404 — Task 4 테스트(`isHomepageMenu`)
4. 가입 승인 화면에서 승인 후 직원 관리로 이동해도 목록이 최신(각 화면이 따로 불러옴) — Task 4 수동 확인 항목
5. 모바일 폭에서 사이드 메뉴 대신 선택 상자로 모든 메뉴에 갈 수 있음(홈페이지 권한자는 홈페이지 묶음만) — Task 3 테스트(`adminNavFor` 결과로 선택 상자를 그림)

---

### Task 1: 새 문의 건수 API

**Files:**
- Modify: `nodejs-server/src/models/homepageModel.js` (문의 함수들 근처)
- Modify: `nodejs-server/src/controllers/adminHomepageController.js`
- Modify: `nodejs-server/src/routes/adminHomepage.js`
- Modify: `nodejs-server/scripts/checkAdminHomepage.js`
- Modify: `hibye-web/src/lib/auth.ts`

**Interfaces:**
- Produces: `Homepage.newInquiryCount(): Promise<number>`, `GET /api/admin/homepage/summary` → `{ newInquiries: number }`, hibye-web `getNewInquiryCount(): Promise<number>`(실패·쿠키 없음 → 0, `getShopAwaitingCount`와 같은 모양)

- [ ] **Step 1: 점검 추가** — `checkAdminHomepage.js`에 `ctrl.summary` 호출 시 `{ newInquiries: 3 }`(가짜 모델이 3 반환), 모델 점검은 SQL에 `FROM hp_inquiry`와 `status = 'new'`가 들어가는지
- [ ] **Step 2: 실행해 실패 확인** — `node scripts/checkAdminHomepage.js` → `ctrl.summary is not a function`
- [ ] **Step 3: 구현** — 모델 `SELECT COUNT(*) AS n FROM hp_inquiry WHERE status = 'new'`(회사 구분 없음 — hp_inquiry는 회사 칸이 없고 다른 문의 함수도 그대로), 컨트롤러 `exports.summary`, 라우트 `router.get('/summary', ctrl.summary)`, `getNewInquiryCount`
- [ ] **Step 4: 통과 확인** — `node scripts/checkAdminHomepage.js`, `node scripts/checkAuth.js`(무인증 401 목록에 영향 없음)
- [ ] **Step 5: 커밋** — `feat: 관리 화면용 새 문의 건수 API`

### Task 2: 메뉴 목록·권한·예전 주소 (`lib/adminNav.ts`)

**Files:**
- Create: `hibye-web/src/lib/adminNav.ts`
- Test: `hibye-web/src/lib/adminNav.test.ts`

**Interfaces:**
- Produces:
  - `type AdminNavItem = { href: string; label: string; badge?: 'pending' | 'inquiries' | 'orders' }`
  - `type AdminNavGroup = { title: string | null; items: AdminNavItem[] }`
  - `HOMEPAGE_MENUS: readonly { key: HomepageMenu; label: string }[]` — 순서·이름: inquiries 문의함, orders 주문, products 개인결제 상품, customers 고객 회원, notice 공지사항, portfolio 포트폴리오, faq FAQ, popup 메인 팝업, pages 안내 페이지
  - `type HomepageMenu`, `isHomepageMenu(v: string): v is HomepageMenu`
  - `adminNavFor(isAdmin: boolean): AdminNavGroup[]` — 관리자: [{null:[대시보드 /admin]}, {직원: 가입 승인 /admin/pending(badge pending)·직원 관리 /admin/members·근태 /admin/leaves·연차·휴가 /admin/balances·조직 /admin/org}, {홈페이지: HOMEPAGE_MENUS → /admin/homepage/<key>(inquiries badge inquiries, orders badge orders)}, {보안: 암호화 키 /admin/security}] / 홈페이지 권한자: 홈페이지 묶음만
  - `HOMEPAGE_HOME = '/admin/homepage/inquiries'`
  - `legacyAdminPath(tab: string | undefined): string | null` — 없으면 null, `homepage` → HOMEPAGE_HOME, pending·members·leaves·balances·org·security → `/admin/<tab>`, 그 밖 → `/admin`
  - `adminRedirect(path: string, isAdmin: boolean): string | null` — 홈페이지 권한자가 `/admin/homepage/…` 밖을 열면 HOMEPAGE_HOME, 그 밖은 null

- [ ] **Step 1: 테스트 작성** — `adminNavFor(true)` 묶음 제목 `[null, '직원', '홈페이지', '보안']`, 링크 15개(대시보드 1 + 직원 5 + 홈페이지 9), `adminNavFor(false)` 제목 `['홈페이지']`·링크 9개 / `legacyAdminPath(undefined)`→null, `'homepage'`→`/admin/homepage/inquiries`, `'members'`→`/admin/members`, `'x'`→`/admin` / `adminRedirect('/admin', false)`→HOMEPAGE_HOME, `('/admin/members', false)`→HOMEPAGE_HOME, `('/admin/homepage/faq', false)`→null, `('/admin', true)`→null / `isHomepageMenu('faq')` true, `'FAQ'`·`'constructor'` false
- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/adminNav.test.ts` → 모듈 없음
- [ ] **Step 3: 구현**(`isHomepageMenu`는 `Object.hasOwn`이 아닌 `HOMEPAGE_MENUS.some(m => m.key === v)` — 프로토타입 키 방지)
- [ ] **Step 4: 통과 확인** — 같은 명령 PASS
- [ ] **Step 5: 커밋** — `feat: 관리 메뉴 목록·권한·예전 주소 변환`

### Task 3: 관리 틀(layout + 사이드 메뉴)

**Files:**
- Create: `hibye-web/src/app/(member)/admin/layout.tsx`
- Create: `hibye-web/src/components/admin/AdminShell.tsx`
- Create: `hibye-web/src/components/admin/AdminHeading.tsx`
- Modify: `hibye-web/src/app/(member)/admin/page.tsx` (Task 5에서 대시보드로 교체 — 여기선 layout과 충돌만 정리)

**Interfaces:**
- Consumes: Task 2 `adminNavFor`, `adminRedirect`, `HOMEPAGE_HOME`; Task 1 `getNewInquiryCount`; 기존 `getAdminPendingCount`, `getShopAwaitingCount`, `getCurrentUser`, `canManageHomepage`
- Produces: `AdminShell({ groups, badges, children }: { groups: AdminNavGroup[]; badges: { pending: number; inquiries: number; orders: number }; children: ReactNode })`, `AdminHeading({ title, desc }: { title: string; desc?: string })` — 각 화면 위 제목·한 줄 설명

- [ ] **Step 1: layout.tsx** — `<Suspense fallback={스켈레톤}>` 안 서버 컴포넌트: 로그인 없음 → `/login?redirect=/admin`, `canManageHomepage` 아님 → `/`. 건수 3개를 `Promise.all`(관리자 아니면 pending 0). `AdminShell`에 `adminNavFor(user_role === 'admin')`.
  - 현재 경로 기반 이동(홈페이지 권한자 → HOMEPAGE_HOME)은 layout이 경로를 모르므로 **각 관리자 전용 page.tsx에서** `requireAdminPage()`(Task 4에서 만들 공용 함수) 로 처리 — layout은 로그인·관리 권한만
- [ ] **Step 2: AdminShell** — 클라이언트, `usePathname`으로 현재 링크 `aria-current="page"`(대시보드는 정확히 `/admin`일 때만). md 이상: `aside` 13rem 왼쪽(묶음 제목 작은 회색 글자, 링크 + 배지 숫자 `text-primary`), 오른쪽 `main` 내용. md 미만: `aside` 숨기고 위쪽 `<select aria-label="관리 메뉴">`(묶음별 `<optgroup>`, 선택 시 `router.push`). 전체 폭 `max-w-6xl mx-auto px-4`.
- [ ] **Step 3: 확인** — `npm run typecheck && npm run lint && npm run build`(dev 서버 3001이 떠 있으면 build 전에 끄기 — CLAUDE.local 주의)
- [ ] **Step 4: 커밋** — `feat: 관리 화면 사이드 메뉴 틀`

### Task 4: 메뉴별 화면

**Files:**
- Create: `hibye-web/src/app/(member)/admin/{pending,members,leaves,balances,org,security}/page.tsx`
- Create: `hibye-web/src/app/(member)/admin/homepage/page.tsx`(→ HOMEPAGE_HOME redirect), `hibye-web/src/app/(member)/admin/homepage/[menu]/page.tsx`
- Create: `hibye-web/src/components/admin/useAdminUsers.ts`
- Create: `hibye-web/src/lib/adminPage.ts`
- Modify: `hibye-web/src/components/admin/homepage/HomepageTab.tsx` → `HomepagePanel({ menu }: { menu: HomepageMenu })`(버튼 줄 제거, 메뉴→패널 렌더만)
- Delete: `hibye-web/src/components/admin/AdminPage.tsx`(역할이 layout·각 page로 옮겨짐)

**Interfaces:**
- Consumes: Task 2 `isHomepageMenu`, `HOMEPAGE_MENUS`, `HOMEPAGE_HOME`; Task 3 `AdminHeading`
- Produces:
  - `requireAdminPage(): Promise<User>`(lib/adminPage.ts, 서버 전용) — 관리자가 아니면 `redirect(HOMEPAGE_HOME)`(layout이 이미 로그인·관리 권한 확인)
  - `useAdminUsers(): { state; users: AdminUser[]; reload; refresh; run: RunAction; notice }` — 지금 `FullAdminPage`의 목록 불러오기·`run`(실행→안내→reload→`router.refresh()`)·안내 문구 상태를 그대로 옮김. `RunAction` 타입도 이 파일에서 export(PendingTab·MembersTab의 import 경로 수정)

- [ ] **Step 1: 관리자 전용 6개 page** — 각 `<Suspense>` 안에서 `await requireAdminPage()` 후 `AdminHeading` + `Card` + 기존 컴포넌트. 제목·설명: 가입 승인 '가입 신청을 승인하거나 거절해요.' / 직원 관리 '직원 정보·권한·상태를 관리해요. 모든 조치는 #hibye-관리에 기록돼요.' / 근태 '월별 근태를 보고 오늘 이후 근태를 대신 취소해요.' / 연차·휴가 '남은 일수를 덮어쓰고 이력을 봐요.' / 조직 '부서·직급을 관리해요.' / 암호화 키 '거래처 접속정보 암호화 키를 확인해요(관리자 비밀번호 확인).'. 가입 승인·직원 관리는 클라이언트 래퍼에서 `useAdminUsers`(대기 목록 = `user_status === 'pending'`)
- [ ] **Step 2: 홈페이지** — `/admin/homepage`는 HOMEPAGE_HOME로 redirect. `[menu]/page.tsx`는 `isHomepageMenu(menu)` 아니면 `notFound()`, 제목 = 해당 메뉴 이름, 설명 'linkbe.kr 홈페이지 내용을 관리해요.', 본문 `HomepagePanel`(공지·포트폴리오는 `key={menu}` 유지)
- [ ] **Step 3: AdminPage.tsx 삭제·import 정리** — `grep -rn "AdminPage\|HomepageTab\|RunAction" src`로 남은 참조 0 확인
- [ ] **Step 4: 확인** — `npm test`(Task 2 포함 전부), `npm run typecheck && npm run lint && npm run build`
- [ ] **Step 5: 커밋** — `feat: 관리 메뉴별 주소(새로고침·뒤로가기 유지)`

### Task 5: 대시보드 + 예전 주소 이동 + 링크 갱신

**Files:**
- Modify: `hibye-web/src/app/(member)/admin/page.tsx`
- Create: `hibye-web/src/components/admin/TodoCards.tsx`
- Modify: `nodejs-server/src/controllers/publicHomepageController.js:140`(Slack 링크)
- Modify: `linkbe-web/src/lib/legacy.ts`(`WORK_DIRS.adm`), `linkbe-web/src/lib/legacy.test.ts`

**Interfaces:**
- Consumes: Task 1 `getNewInquiryCount`, Task 2 `legacyAdminPath`·`HOMEPAGE_HOME`, 기존 `getAdminPendingCount`·`getShopAwaitingCount`·`getWorkPendingCount`·`canApproveExpense`, `lib/adminPage.ts`
- Produces: `TodoCards({ items }: { items: { label: string; desc: string; count: number; href: string }[] })`

- [ ] **Step 1: page.tsx** — `searchParams.tab`이 있으면 `redirect(legacyAdminPath(tab))`. 관리자 아니면 `redirect(HOMEPAGE_HOME)`. 카드: 가입 승인 대기(/admin/pending, '승인을 기다리는 가입 신청'), 새 문의(/admin/homepage/inquiries, '아직 확인하지 않은 문의'), 입금 대기(/admin/homepage/orders, '무통장 입금 확인이 필요한 주문'), 경비 승인 대기(/work/expense, '승인을 기다리는 경비' — `canApproveExpense`일 때만). 제목 '처리할 일'
- [ ] **Step 2: TodoCards** — 2열 격자(모바일 1열), 카드 = 건수(크게) + 이름 + 설명 + '바로가기 →'. 0건이면 `opacity-60`, 건수 자리에 '처리할 일 없음'
- [ ] **Step 3: 링크 갱신** — Slack 문의 알림 `https://hibye.kr/admin/homepage/inquiries`, linkbe-web `adm` → `/admin/homepage/inquiries`(legacy.test.ts 기대값 `${STAFF_SITE}/admin/homepage/inquiries`)
- [ ] **Step 4: 확인** — hibye-web `npm test && npm run typecheck && npm run lint && npm run build`, nodejs-server `node scripts/checkInquiry.js`(Slack 문구 점검이 있으면 기대값 갱신), linkbe-web `npx vitest run && npx tsc --noEmit`
- [ ] **Step 5: 커밋** — hibye `feat: 관리 대시보드(처리할 일)·예전 관리 주소 이동`, linkbe-web `fix: 예전 /adm 주소를 새 관리 주소로`

### 수동 확인(사용자 — 로그인 필요)
- 각 메뉴에서 새로고침·뒤로가기 시 같은 화면, 사이드 메뉴 선택 표시·배지 숫자
- 휴대폰 폭에서 선택 상자로 이동
- 홈페이지 권한만 있는 계정: 홈페이지 묶음만 보이고 `/admin` → 문의함
- 가입 승인 후 직원 관리로 이동 시 목록 최신
- Slack 문의 알림 링크·`/admin?tab=homepage` 예전 링크가 새 화면으로
