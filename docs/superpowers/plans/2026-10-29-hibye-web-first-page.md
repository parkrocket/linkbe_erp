# hibye-web 첫 진입 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `hibye-web/` Next.js 앱을 만들고 첫 진입 페이지 `/`(로그인 전 소개 랜딩, 로그인 후 대시보드)와 로그인 흐름을 구현해 운영 서버에 비노출 상태로 배포한다.

**Architecture:** Next.js App Router 서버 렌더링. 브라우저는 같은 출처 `/node/api/*`로 기존 `nodejs-server`를 호출하고(로컬은 `rewrites`), 서버 컴포넌트는 `API_INTERNAL_URL`로 쿠키를 전달해 호출한다. 인증 판단은 API 서버(`/api/users/auth`)가 하고 Next는 토큰을 읽지 않는다.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind CSS 4, lucide-react, Vitest(순수 로직 테스트), pm2

**Spec:** `docs/superpowers/specs/2026-10-29-hibye-nextjs-design.md`

## Global Constraints

- Node 22.23.4 이상. 패키지 매니저 npm.
- 코드 스타일: 저장소 `.prettierrc` — 들여쓰기 4칸, 작은따옴표, 세미콜론. 한국어 주석.
- 대표색 `#5e2bb8`. 대표색은 주요 행동·현재 위치에만 사용(화면당 핵심 버튼 1개).
- 상태 표시는 색 + 글자 병기.
- 브라우저의 API 호출은 반드시 `/node/api/...` 상대 경로. 절대 URL·`localhost:5000` 직접 호출 금지.
- 화면 코드는 `x_auth` 쿠키를 읽거나 쓰지 않는다.
- 추가 의존성은 `lucide-react`, `vitest`만 허용(그 외는 사전 합의).
- 공개 저장소 — 코드·주석·커밋에 서버 IP·비밀값 금지.
- 커밋 메시지 "타입: 한국어 내용" + `Co-Authored-By` 줄.

## Review Focus

1. 출근 기록 없는 직원(`start_time` null)이 지각으로 집계되면 안 된다 — 기존 코드는 `moment(undefined)`=현재시각이라 10:01 이후 모두 지각으로 셈. → Task 6 `summarizeWorkStatus` 테스트로 고정.
2. API가 401을 주면(토큰 만료 등) 화면이 깨지지 않고 로그인으로 이동해야 한다. → Task 3 `apiFetch` 테스트.
3. API 서버가 내려가 있거나 5xx일 때 대시보드 카드는 ErrorState(재시도)를 보여야 하고 페이지 전체가 실패하면 안 된다. → Task 6 카드별 에러 경계.
4. 로그인 후 `redirect` 파라미터로 외부 URL(`//evil.com`, `https://...`)이 오면 무시하고 `/`로 가야 한다(오픈 리다이렉트). → Task 4 `safeRedirect` 테스트.
5. 오늘 근무가 9시간을 넘으면 진행 막대가 100%에서 멈춰야 한다. → Task 6 `todayWorkProgress` 테스트.

---

## File Structure

```
nodejs-server/src/utils/safeUser.js        사용자 행에서 민감 필드 제거 (Task 1)
hibye-web/
  next.config.ts                            rewrites /node → API, output standalone
  vitest.config.ts
  .env.example                              API_INTERNAL_URL
  src/app/globals.css                       디자인 토큰 (@theme)
  src/app/layout.tsx                        Header·Footer·Pretendard
  src/app/page.tsx                          / 분기 (Landing | Dashboard)
  src/app/(public)/login/page.tsx           로그인
  src/middleware.ts                         (member) 경로 보호
  src/lib/api.ts                            apiFetch, ApiError
  src/lib/auth.ts                           getCurrentUser
  src/lib/redirect.ts                       safeRedirect
  src/lib/work.ts                           summarizeWorkStatus, todayWorkProgress
  src/lib/types.ts                          User, GtwRecord
  src/components/ui/*.tsx                   Button, Card, Badge, Skeleton, EmptyState, ErrorState
  src/components/layout/Header.tsx, Footer.tsx, MobileMenu.tsx
  src/components/landing/Landing.tsx
  src/components/dashboard/*.tsx            Dashboard, TodayWorkCard, CompanyStatusCard, ComingSoonCard
.github/workflows/deploy-hibye-web.yml
```

---

### Task 1: API 응답에서 비밀번호 해시 제거 (gtw)

`gtw/gtwStatus`·`gtw/gtwStatusAll`이 `lk_user`를 `SELECT *`로 조인해 직원 전원의 `user_password`를 내려보낸다. 새 대시보드가 이 API를 쓰므로 먼저 막는다.

**Files:**
- Create: `nodejs-server/src/utils/safeUser.js`
- Modify: `nodejs-server/src/controllers/userController.js` (기존 `toSafeUser` 정의를 import로 교체)
- Modify: `nodejs-server/src/controllers/gtwController.js` (`gtwStatus`, `gtwStatusAllWeb` 응답)
- Test: `nodejs-server/scripts/checkSafeUser.js`

**Interfaces:**
- Produces: `toSafeUser(row: object) => object` — `user_password` 키 제거, 나머지 유지. `module.exports = { toSafeUser }`

- [ ] **Step 1: 실패 테스트 작성** — `scripts/checkSafeUser.js`
```js
const assert = require('assert');
const { toSafeUser } = require('../src/utils/safeUser');
const row = { user_id: 'a@b.c', user_name: '홍', user_password: '$2b$hash', start_time: null };
assert.deepStrictEqual(toSafeUser(row), { user_id: 'a@b.c', user_name: '홍', start_time: null });
assert.ok(!('user_password' in toSafeUser({ user_password: 'x' })));
console.log('checkSafeUser ✅');
```
- [ ] **Step 2: 실행해 실패 확인** — `node nodejs-server/scripts/checkSafeUser.js` → `Cannot find module '../src/utils/safeUser'`
- [ ] **Step 3: 구현** — `safeUser.js`에 `toSafeUser`, userController의 로컬 정의 삭제 후 import. gtwController: `gtwStatus`는 `gtw: gtw && toSafeUser(gtw)`, `gtwStatusAllWeb`는 `gtw: gtw.map(toSafeUser)`.
- [ ] **Step 4: 통과 확인** — `node nodejs-server/scripts/checkSafeUser.js` → `checkSafeUser ✅`, `node nodejs-server/scripts/checkAuth.js` → `모든 점검 통과`
- [ ] **Step 5: 수동 확인** — 로컬 로그인 상태(시크릿 창)에서 대시보드 정상, DevTools Network의 `gtwStatusAll` 응답에 `user_password` 없음
- [ ] **Step 6: 커밋** — `fix: 근태 API 응답에서 직원 비밀번호 해시 제거`

---

### Task 2: hibye-web 프로젝트 생성 + 디자인 토큰 + 공통 UI

**Files:**
- Create: `hibye-web/` (create-next-app), `hibye-web/.prettierrc`(루트와 동일 설정), `next.config.ts`, `vitest.config.ts`, `.env.example`, `src/app/globals.css`, `src/components/ui/{Button,Card,Badge,Skeleton,EmptyState,ErrorState}.tsx`, `src/app/ui-preview/page.tsx`(개발 확인용, Task 7에서 삭제)
- Modify: 루트 `.gitignore` 불필요(앱 자체 .gitignore 사용)

**Interfaces:**
- Produces:
  - `next.config.ts`: `output: 'standalone'`, `rewrites` → `/node/:path*` → `${process.env.API_INTERNAL_URL ?? 'http://localhost:5000'}/:path*`
  - 토큰(`@theme`): `--color-primary: #5e2bb8`, `--color-primary-hover: #4c2296`, `--color-primary-soft: #f3eefc`, `--color-ink: #1f1b2e`, `--color-muted: #6b6880`, `--color-line: #eeecf3`, `--color-surface: #f7f6fb`, `--radius-card: 12px`
  - `Button({ variant?: 'primary' | 'secondary' | 'ghost', ...button props })`
  - `Card({ title?: string, action?: ReactNode, children })`
  - `Badge({ tone: 'pending' | 'approved' | 'rejected' | 'info' | 'neutral', children })`
  - `Skeleton({ className?: string })`, `EmptyState({ message: string })`, `ErrorState({ message?: string, onRetry?: () => void })`

- [ ] **Step 1: 생성** — 저장소 루트에서 `npx create-next-app@latest hibye-web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` (나머지 질문은 기본값). `npm i lucide-react && npm i -D vitest`
- [ ] **Step 2: 설정** — next.config.ts(위 Interfaces), `package.json` scripts에 `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`. Pretendard는 `layout.tsx`의 `<link>`로 jsdelivr CSS 사용(`https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css`).
- [ ] **Step 3: 토큰·UI 컴포넌트 구현** — Badge는 tone별 배경/글자색 + children 글자 필수(색만으로 표현 금지). Button primary만 대표색. 모든 인터랙티브 요소 `focus-visible` 링.
- [ ] **Step 4: 미리보기 페이지** — `/ui-preview`에 모든 컴포넌트 상태 나열
- [ ] **Step 5: 검증** — `npm run typecheck && npm run build` 통과. `npm run dev`(포트 3001) 후 browser-automation으로 `/ui-preview` 스크린샷 확인: 콘솔 에러 0, 대표색 버튼 1종, Badge 글자 표시
- [ ] **Step 6: 커밋** — `feat: hibye-web Next.js 프로젝트 생성 및 디자인 토큰·공통 UI 추가`

---

### Task 3: API 클라이언트

**Files:**
- Create: `hibye-web/src/lib/types.ts`, `src/lib/api.ts`, `src/lib/api.test.ts`

**Interfaces:**
- Produces:
  - `type User = { user_id: string; user_name: string; cp_id: number; [key: string]: unknown }`
  - `type GtwRecord = { user_id: string; user_name?: string; start_time: string | null; end_time: string | null; gtw_location: 'office' | 'home' | null; type?: string | null }`
  - `class ApiError extends Error { status: number }`
  - `apiFetch<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown; cookie?: string }): Promise<T>` — `path`는 `/api/...`. 브라우저에서는 `/node${path}`, 서버(`typeof window === 'undefined'`)에서는 `${process.env.API_INTERNAL_URL}${path}` + `cookie` 헤더. `res.ok` 아니면 `ApiError(status)` throw. `cache: 'no-store'`.

- [ ] **Step 1: 실패 테스트** — `api.test.ts` (fetch를 `vi.stubGlobal`로 대체)
  - `apiFetch('/api/x')` 200 `{a:1}` → `{a:1}` 반환, 호출 URL이 서버 환경에서 `${API_INTERNAL_URL}/api/x`
  - 401 응답 → `ApiError`이고 `status === 401`
  - 500 응답 → `ApiError` `status === 500`
  - `cookie: 'x_auth=t'` 전달 시 요청 헤더 `cookie`가 `x_auth=t`
  - body 객체 → `JSON.stringify`, `Content-Type: application/json`
- [ ] **Step 2: 실패 확인** — `npm test` → `apiFetch is not defined`류 실패
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — `npm test` 전부 PASS
- [ ] **Step 5: 커밋** — `feat: hibye-web API 클라이언트 추가`

---

### Task 4: 인증 — 현재 사용자, 경로 보호, 로그인 화면

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/redirect.ts`, `src/lib/redirect.test.ts`, `src/middleware.ts`, `src/app/(public)/login/page.tsx`, `src/app/(public)/login/LoginForm.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError`, `User` (Task 3)
- Produces:
  - `getCurrentUser(): Promise<User | null>` (server only) — 서버에서만 `cookies().get('x_auth')`를 읽어 `POST /api/users/auth`(body `{ x_auth }` — 기존 API 계약, 쿠키 헤더도 전달) 호출, `isAuth`면 `user`, 아니면 `null`. 쿠키 없으면 API 호출 없이 `null`.
  - `safeRedirect(target: string | null): string` — `/`로 시작하고 `//`·`/\`로 시작하지 않는 경로만 그대로, 그 외 `/`
  - `middleware`: `matcher`는 이후 추가될 member 경로(기존 경로 `/vaca`, `/geo`, `/work`, `/workHistory`, `/sent`, `/calendar`). `x_auth` 쿠키 없으면 `/login?redirect=<pathname>`으로 redirect. `/`·`/login`·`/register`·`/gtw`는 제외.

- [ ] **Step 1: 실패 테스트** — `redirect.test.ts`
  - `safeRedirect('/work')` → `'/work'`; `safeRedirect(null)` → `'/'`
  - `safeRedirect('//evil.com')`, `safeRedirect('https://evil.com')`, `safeRedirect('/\\evil.com')` → `'/'`
- [ ] **Step 2: 실패 확인** — `npm test`
- [ ] **Step 3: 구현** — auth.ts, redirect.ts, middleware.ts, 로그인 화면(이메일·비밀번호, 에러 문구는 기존 API `error` 대신 "이메일 또는 비밀번호를 확인해 주세요" 단일 문구, 제출 중 버튼 비활성, 성공 시 `router.replace(safeRedirect(searchParams.get('redirect')))` 후 `router.refresh()`). 로그인 POST는 `/node/api/users/login` — 쿠키는 API가 설정.
- [ ] **Step 4: 통과 확인** — `npm test` PASS, `npm run typecheck`
- [ ] **Step 5: 수동 확인** — API(5000)·터널 기동 상태에서 `npm run dev` → `/login` 로그인 → `/`로 이동, DevTools Application에서 `x_auth` 쿠키 존재. 쿠키 삭제 후 `/calendar` 접근 → `/login?redirect=/calendar`
- [ ] **Step 6: 커밋** — `feat: hibye-web 로그인 및 인증 흐름 추가`

---

### Task 5: 공통 레이아웃 + 로그인 전 소개 랜딩

**Files:**
- Create: `src/components/layout/{Header,Footer,MobileMenu}.tsx`, `src/components/landing/Landing.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser` (Task 4), UI 컴포넌트 (Task 2)
- Produces: `Header({ user: User | null })`, `Landing()`; `page.tsx`는 `user ? <Dashboard user={user} /> : <Landing />` (Dashboard는 Task 6 전까지 임시 `<p>`)

- [ ] **Step 1: 구현** — Header: 로그인 전 [로그인](텍스트) [회원가입](primary); 로그인 후 메뉴 홈·근태·휴가·결재·일정(링크는 기존 경로, 현재 위치 대표색 밑줄) + 이름 드롭다운(로그아웃: `POST /node/api/users/logout` → `router.refresh()`). 768px 미만 햄버거(MobileMenu, `aria-expanded`). Footer: 기존 문구 유지. Landing 카피(정확히): 헤드라인 "출근부터 휴가까지,\nhibye 하나로"(hibye 대표색), 서브 "링크비 구성원을 위한 근태·휴가·결재 관리", 버튼 [시작하기]→`/login`, 카드 "출퇴근"·"휴가"·"결재"(lucide 아이콘)
- [ ] **Step 2: 검증** — 로그아웃 상태 `/`: browser-automation 스크린샷(데스크톱 1280, 모바일 390) 확인 — 겹침·잘림 없음, 콘솔 에러 0, 대표색 버튼 1개. 키보드 Tab으로 메뉴·버튼 포커스 링 보임
- [ ] **Step 3: 커밋** — `feat: hibye-web 공통 레이아웃 및 소개 랜딩 추가`

---

### Task 6: 로그인 후 대시보드

**Files:**
- Create: `src/lib/work.ts`, `src/lib/work.test.ts`, `src/components/dashboard/{Dashboard,TodayWorkCard,CompanyStatusCard,ComingSoonCard}.tsx`
- Modify: `src/app/page.tsx` (임시 `<p>` → `<Dashboard user={user} />`)

**Interfaces:**
- Consumes: `apiFetch`, `GtwRecord`, `User`, UI 컴포넌트
- Produces:
  - `summarizeWorkStatus(records: GtwRecord[], date: string): { office: number; home: number; left: number; vacation: number; late: number; overtime: number; underwork: number }` — 기존 `WorkStatus.js` 규칙: 근무 중(start 있고 end 없음)을 location별로; 지각 = **start_time이 있고** `${date} 10:01:00` 이후; 퇴근 = start·end 모두; 초과 = end > start+9h; 미달 = 그 외 근무분 < 540; 휴가 = type ∈ {vacation, day, half}
  - `todayWorkProgress(start: string | null, end: string | null, now: Date): { workedMinutes: number; expectedEnd: string | null; percent: number }` — percent = floor(worked/540*100), 최대 100; start 없으면 `{0, null, 0}`; expectedEnd = end ?? start+9h, `HH:mm`
  - 카드: `TodayWorkCard({ userId })`(오늘 `POST /api/gtw/gtwStatus` `{userId, date}`), `CompanyStatusCard({ cpId })`(`POST /api/gtw/gtwStatusAll` `{date, cpId}`), `ComingSoonCard({ title: string })`

- [ ] **Step 1: 실패 테스트** — `work.test.ts`
  - 출근 기록 없는 직원 1명, date 10:30 이후 → `late === 0` (Review Focus 1)
  - start `10:05` → `late === 1`; start `09:00` end `18:30` → `left 1, overtime 1`; start `09:00` end `17:00` → `underwork 1`
  - start 있고 end 없음 + `gtw_location: 'home'` → `home 1`; `type: 'half'` → `vacation 1`
  - `todayWorkProgress('…T09:00', null, …T20:00)` → `percent === 100` (Review Focus 5); start `09:00` → `expectedEnd === '18:00'`; start null → `percent 0, expectedEnd null`
- [ ] **Step 2: 실패 확인** — `npm test`
- [ ] **Step 3: 구현** — work.ts. 카드는 클라이언트 컴포넌트로 각자 로딩(Skeleton)·에러(ErrorState+재시도)를 가진다 — 한 카드 실패가 다른 카드에 영향 없음(Review Focus 3). 401 `ApiError` → `router.replace('/login?redirect=/')`(Review Focus 2). Dashboard 배치: 인사말("{이름}님, 좋은 하루예요 👋" + `Intl` 날짜 "2026년 10월 29일 목요일") → [오늘 근무 | 결재(준비 중)] → [회사 근무 현황] → [공지사항(준비 중)]. 오늘 근무 카드 버튼 자리는 비활성 버튼 + "웹 출근은 준비 중이에요 · Slack에서 출근해 주세요". 데이터 없는 상태 문구: "아직 출근 기록이 없어요".
- [ ] **Step 4: 통과 확인** — `npm test`, `npm run typecheck`
- [ ] **Step 5: 수동 확인** — 로그인 후 `/`가 기존 react-app 대시보드(localhost:3000)와 같은 출근 시각·인원 수를 보이는지 비교. API 서버 중지 상태에서 카드별 ErrorState·재시도 동작. 스크린샷(데스크톱·모바일) 확인
- [ ] **Step 6: 커밋** — `feat: hibye-web 대시보드 추가`

---

### Task 7: 운영 배포(비노출) 워크플로

**Files:**
- Create: `.github/workflows/deploy-hibye-web.yml`
- Delete: `hibye-web/src/app/ui-preview/`

**Interfaces:**
- Consumes: GitHub Secrets `EC2_HOST`, `EC2_USER`, `EC2_KEY` (기존)
- Produces: 서버 `~/hibye-web`에서 pm2 프로세스 `hibye-web`, `PORT=3001`, `HOSTNAME=127.0.0.1`, `API_INTERNAL_URL=http://127.0.0.1:5000`

- [ ] **Step 1: 워크플로 작성** — 트리거 `push` `master` paths `hibye-web/**`. Node 22, `npm install`, `npm test`, `npm run typecheck`, `npm run build`. `.next/standalone` + `.next/static`→`standalone/hibye-web/.next/static` + `public` 복사 후 rsync → `~/hibye-web/`. 원격: `cd ~/hibye-web && PORT=3001 HOSTNAME=127.0.0.1 API_INTERNAL_URL=http://127.0.0.1:5000 pm2 restart hibye-web --update-env || pm2 start server.js --name hibye-web` (환경변수 동일) 후 `pm2 save`. 기존 워크플로의 `actions/checkout@v4`, `setup-node@v4` 사용.
- [ ] **Step 2: 사전 확인(서버)** — `free -m`로 가용 메모리 ≥ 300MB 확인. 미달 시 중단하고 보고
- [ ] **Step 3: 배포** — push 후 Actions `success`
- [ ] **Step 4: 비노출 검증** — 외부에서 `https://hibye.kr` 여전히 기존 React(빌드 파일명 `main.*.js`) / 3001 외부 접속 불가. SSH 터널 `-L 3301:127.0.0.1:3001`로 `http://localhost:3301` 소개 랜딩 렌더 확인(로그인은 쿠키 도메인이 달라 전환 후 검증)
- [ ] **Step 5: 커밋** — `chore: hibye-web 운영 배포 워크플로 추가 (nginx 미연결)`

---

## 범위 밖 (후속 계획)
나머지 화면 전환(로그인 외 회원가입·근태·휴가·결재·일정·Slack `/gtw`), 전환일 작업(nginx 전환, httpOnly), 결재·공지·웹 출근 API.
