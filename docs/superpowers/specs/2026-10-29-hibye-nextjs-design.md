# hibye Next.js + TypeScript 전환 설계

- 작성일: 2026-10-29
- 상태: 승인됨 (구현 계획 작성 전)
- 범위: hibye.kr 관리 플랫폼 프론트엔드(`react-app`)를 Next.js + TypeScript로 전환. 첫 작업은 첫 진입 페이지(`/`).

## 1. 목적과 결정 사항

| 항목 | 결정 |
|---|---|
| 전환 이유 | 유지보수·표준화(CRA 개발 중단, 사내 표준 스택) + 이후 그누보드 홈페이지 이전의 기반 |
| 홈페이지와의 관계 | 도메인이 달라 **저장소 하나에 앱 둘** (`hibye-web/`, 이후 `homepage-web/`). DB 공유는 `nodejs-server` API를 함께 쓰는 방식으로 이후 별도 설계 |
| 반영 방식 | **전체 전환 후 한 번에 교체**. 전환 중 운영은 기존 React 유지 |
| 디자인 | 현재 구조를 다듬는 A안(상단 메뉴 + 카드), **대표색 `#5e2bb8`**, UI/UX 품질 최우선 |
| 로그인 전 `/` | 소개 랜딩 + 로그인/회원가입 버튼 |
| 기술 접근 | Next.js 서버 렌더링 + 기존 `nodejs-server` API 그대로 사용 (백엔드 변경 최소) |
| API 없는 기능 | 결재·공지사항·웹 출근 버튼은 **자리만 두고 "준비 중"** 표시. 실제 기능은 3단계에서 API와 함께 |

범위 밖: `nodejs-server` 기능 변경, 그누보드 홈페이지, 공통 패키지 분리(실제 중복이 생길 때), 자동 로그인·토큰 연장.

## 2. 폴더 구조와 스택

```
hibye/
├─ hibye-web/                 새 Next.js 앱
│  ├─ src/app/
│  │  ├─ page.tsx             `/` — 로그인 여부로 소개 랜딩/대시보드 분기 (같은 경로를 두 그룹에 둘 수 없어 단일 페이지)
│  │  ├─ (public)/            로그인 전: 로그인, 회원가입, Slack 출근 링크(/gtw)
│  │  ├─ (member)/            로그인 필요: 근태, 휴가, 결재, 일정 …
│  │  ├─ layout.tsx           공통 Header·Footer, Pretendard
│  │  └─ globals.css          디자인 토큰(CSS 변수)
│  ├─ src/components/ui/      Button, Card, Badge, Skeleton, EmptyState, ErrorState
│  ├─ src/lib/api.ts          API 호출(서버·브라우저 공용), 에러 처리 일원화
│  ├─ src/lib/auth.ts         현재 사용자 조회(쿠키 → /api/users/auth)
│  └─ src/middleware.ts       로그인 필요 경로 접근 검사
├─ react-app/                 기존 앱 (전환일까지 운영)
├─ nodejs-server/             API 서버
└─ homepage-web/              (이후) 홈페이지
```

| 항목 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js 16 (App Router) | 최신 안정판, Node 22.23.4 충족 |
| 언어 | TypeScript strict | 타입으로 버그 감소가 전환 목적 |
| 스타일 | Tailwind CSS 4 + CSS 변수 토큰 | 기존에도 Tailwind 사용, 색·간격 한 곳에서 관리 |
| 상태 관리 | 없음 (Redux 제거) | 전역 상태는 로그인 사용자뿐 → 서버에서 조회해 전달 |
| 데이터 요청 | 내장 `fetch` | axios 불필요 |
| 아이콘 | lucide-react | FontAwesome 5개 패키지 대체 |
| 날짜 | `Intl.DateTimeFormat` | moment·date-fns 중복 제거 |
| 코드 스타일 | 저장소 `.prettierrc` (4칸, 작은따옴표, 세미콜론) | 기존 규칙 유지 |

TypeScript 버전은 `create-next-app` 기본값을 따른다. 일정(FullCalendar) 유지 여부는 해당 화면 전환 시 결정한다.

## 3. 인증 흐름

- **API 경로 통일**: 브라우저는 항상 같은 출처의 `/node/api/...`를 호출한다.
  - 운영: nginx가 `/node/` → API 서버 (현행)
  - 로컬: Next.js `rewrites`로 `/node/:path*` → `http://localhost:5000/:path*`
  - 서버 컴포넌트·middleware에서는 내부 주소(`API_INTERNAL_URL`)로 호출하며 요청 쿠키를 전달
- **로그인**: 폼 → `/node/api/users/login`. 쿠키(`x_auth`)는 API 서버가 설정하며 화면 코드는 토큰을 읽거나 쓰지 않는다.
- **접근 검사**: `middleware.ts`가 `(member)` 경로에 쿠키가 없으면 `/login?redirect=<원래 경로>`로 보낸다. 토큰 검증 자체는 API 서버가 한다(JWT 비밀키는 API 서버에만).
- **`/` 분기**: 서버에서 `/api/users/auth`로 사용자 조회 → 미로그인 시 소개 랜딩, 로그인 시 대시보드를 서버에서 렌더링(깜빡임 없음).
- **에러 처리**: `lib/api.ts` 한 곳에서 401 → 로그인 화면 이동, 그 외 → ErrorState(안내 + 다시 시도). 처리되지 않은 Promise 에러를 남기지 않는다.
- **로그아웃**: `/node/api/users/logout`(쿠키 삭제) → 소개 랜딩.
- **Slack 출근 링크 `/gtw`**: 공개 페이지 유지.
- **전환일 보안 강화**: 새 앱은 JS로 쿠키를 읽지 않으므로 전환과 동시에 API의 `x_auth` 쿠키를 `httpOnly`로 변경한다.

## 4. 화면 구성 (첫 페이지)

### 공통
- 헤더: 로고, 메뉴(홈·근태·휴가·결재·일정 — 현재 위치는 대표색 밑줄), 사용자 이름 + 드롭다운(로그아웃)
- 모바일: 햄버거 메뉴, 카드 1열
- 푸터: 현행 유지. 사업자번호·대표·전화 등 예시 값은 실제 정보로 교체 필요(정보 수령 후)

### 로그인 전 `/` — 소개 랜딩
- 헤드라인 "출근부터 휴가까지, hibye 하나로" + [시작하기](→ 로그인)
- 기능 카드 3개: 출퇴근 · 휴가 · 결재
- 정적 렌더링(데이터 호출 없음)

### 로그인 후 `/` — 대시보드
| 카드 | 데이터 | 비고 |
|---|---|---|
| 인사말 + 날짜 | 로그인 사용자 | |
| 오늘 근무(출근 시각·예상 퇴근·진행 막대) | `POST /api/gtw/gtwStatus` | |
| 회사 근무 현황(사무실·재택·휴가·지각 등 인원) | `POST /api/gtw/gtwStatusAll` | |
| 출근·퇴근 버튼 | 없음 | "준비 중" (현재도 미동작) |
| 결재 | 없음 | "준비 중" (현재 하드코딩 예시) |
| 공지사항 | 없음 | "준비 중" (현재 하드코딩 예시) |

### UI/UX 원칙 (전 화면 공통)
- 대표색은 주요 행동·현재 위치에만, 화면당 핵심 버튼 1개
- 상태는 색 + 글자 병기(대기/승인/반려) — 색약 대응
- 디자인 토큰으로 색·간격·글자 크기 단계 통일
- 로딩은 Skeleton, 빈 데이터는 EmptyState, 실패는 ErrorState(재시도)
- 키보드 포커스 표시, 버튼·링크 접근 가능한 이름

## 5. 배포와 전환

### 전환 전
- 새 워크플로 `deploy-hibye-web.yml`: `hibye-web/**` 변경 시 GitHub Actions에서 `next build`(standalone) → 결과물만 서버로 전송 → pm2 `hibye-web`(3001) 재시작
- 3001은 외부 미개방 + nginx 미연결 → 사용자에게 노출되지 않음. 기존 React 계속 서비스
- 운영 환경 확인은 SSH 터널로 수행

### 전환일
1. 최종 점검: 전 화면 동작, `nodejs-server/scripts/checkAuth.js`, 모바일
2. nginx: `/` → `127.0.0.1:3001` (기존 정적 파일 대신), `/node/`는 유지
3. API `x_auth` 쿠키 `httpOnly` 적용
4. 기존 `deploy-react.yml` 비활성화

### 되돌리기
- nginx 설정 원복 + reload (1분 내). 기존 `/var/www/html`은 전환 후 일정 기간 보존. httpOnly 적용분도 함께 원복.

### 전환 전 확인 필요
- 운영 nginx 설정 파일 위치
- 서버 메모리 여유 (Next.js 프로세스 추가분)

## 6. 검증
- 화면별: 기존 화면과 동일 데이터 비교, 브라우저 자동 점검(콘솔 에러 0, 스크린샷 확인)
- 정적 검사: `tsc --noEmit`, `next build` 통과 시에만 배포
- 보안 회귀: `checkAuth.js` 로컬·운영 통과
