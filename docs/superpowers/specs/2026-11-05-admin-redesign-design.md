# 관리자 페이지 개편 — 메뉴별 주소·사이드 메뉴·처리할 일 대시보드 (2026-11-05)

## 목표
- 관리 화면의 메뉴(탭)마다 주소가 있어 새로고침·뒤로가기·주소 공유 시 같은 화면이 유지된다.
- 왼쪽 사이드 메뉴로 배치를 정리한다(홈페이지의 2단 탭 제거).
- `/admin` 첫 화면은 관리자가 손대야 할 일(처리할 일)을 한눈에 보여 준다.

## 범위 밖
- 각 탭 안의 기능·표 모양 변경(기존 컴포넌트 그대로 사용)
- 근태 현황·매출·직원 요약 같은 다른 대시보드 정보(사용자 결정: '처리할 일'만)

## 주소
| 주소 | 화면 | 권한 |
|---|---|---|
| `/admin` | 대시보드(처리할 일) | 관리자. 홈페이지 권한만 있으면 `/admin/homepage/inquiries`로 이동 |
| `/admin/pending` | 가입 승인 | 관리자 |
| `/admin/members` | 직원 관리 | 관리자 |
| `/admin/leaves` | 근태 | 관리자 |
| `/admin/balances` | 연차·휴가 | 관리자 |
| `/admin/org` | 조직 | 관리자 |
| `/admin/homepage/{inquiries,orders,products,customers,notice,portfolio,faq,popup,pages}` | 홈페이지 하위 9개 | 관리자 또는 홈페이지 권한 |
| `/admin/security` | 보안(암호화 키) | 관리자 |

- `/admin/homepage`는 `/admin/homepage/inquiries`로 이동.
- 예전 주소 `/admin?tab=<탭>`은 새 주소로 이동(`homepage` → `/admin/homepage/inquiries`, 그 밖은 `/admin/<탭>`, 모르는 값은 `/admin`). Slack 문의 알림 링크(`publicHomepageController`)는 `https://hibye.kr/admin/homepage/inquiries`로 바꾼다. linkbe-web `legacy.ts`의 `/adm` 대상도 같은 주소로.
- 권한이 없는 화면을 주소로 열면: 로그인 안 함 → `/login?redirect=<주소>`, 홈페이지 권한자가 관리자 화면 → `/admin/homepage/inquiries`, 둘 다 아님 → `/`. API는 지금처럼 다시 검사(requireAdmin·requireHomepage).

## 화면 구조
- `app/(member)/admin/layout.tsx`: 로그인·권한 확인(쿠키를 읽으므로 `<Suspense>` 안) 후 `AdminShell`(사이드 메뉴 + 내용 칸)을 그림. 각 화면은 `app/(member)/admin/<메뉴>/page.tsx`가 기존 탭 컴포넌트를 그대로 렌더.
- `AdminShell`(클라이언트): 메뉴 목록은 `lib/adminNav.ts` 한 곳(묶음·주소·이름·권한). 현재 주소(`usePathname`)로 선택 표시(`aria-current="page"`).
  - 데스크톱(md 이상): 왼쪽 고정 폭 메뉴(묶음 제목: 직원 / 홈페이지 / 보안) + 오른쪽 내용 카드.
  - 모바일: 메뉴 대신 위쪽 `<select>`(묶음별 optgroup)로 이동.
  - 배지: 가입 승인 대기(관리자), 새 문의, 입금 대기(주문) 건수.
- 각 화면 위: 제목 + 한 줄 설명(지금 `/admin` 상단 문구를 메뉴별로 나눔).
- 가입 승인·직원 관리는 지금처럼 `/api/admin/users` 목록을 써서 결과 안내(notice)·`run` 처리를 함. 두 화면이 나뉘므로 각 화면에서 목록을 불러오고, 안내 문구와 `run`은 공용 훅(`useAdminUsers`)으로 묶음.
- 홈페이지 하위 9개는 지금 `HomepageTab`의 패널을 그대로 사용(2단 버튼 줄은 제거).
- 홈페이지 권한만 있는 직원: 사이드 메뉴에 홈페이지 묶음만.

## 대시보드 '처리할 일'
- 카드 4장(권한에 맞는 것만): 가입 승인 대기(관리자) · 새 문의(상태 `new`) · 무통장 입금 대기 · 경비 승인 대기(경비 승인 권한)
- 카드: 건수 + 설명 + 바로가기(`/admin/pending`, `/admin/homepage/inquiries`, `/admin/homepage/orders`, `/work/expense`). 0건이면 흐리게 '처리할 일 없음'.
- 건수: 서버 컴포넌트에서 헤더 배지와 같은 함수 사용(`getAdminPendingCount`·`getShopAwaitingCount`·`getWorkPendingCount`) + 새 함수 `getNewInquiryCount`.
- 새 API `GET /api/admin/homepage/summary`(requireHomepage) → `{ newInquiries }` = `hp_inquiry`의 `status = 'new'` 건수. 사이드 메뉴 '문의' 배지도 같은 값.

## 디자인
- 기존 색 토큰·`Card`·배지 모양 유지. 바꾸는 것은 배치·여백.
- 내용 폭: 사이드 메뉴(약 13rem) + 내용 최대 `max-w-6xl` 안.
- 스크롤바 등 전역 규칙은 그대로(컴포넌트별 스크롤바 금지 규칙 준수).

## 오류 처리
- 건수 함수는 실패하면 0(헤더 배지와 같은 함수·같은 동작). 대시보드도 그대로 0으로 표시 — 실패를 따로 구분하지 않음(ponytail: 필요해지면 함수가 null을 돌려주게).
- 각 화면 데이터 오류는 기존 컴포넌트의 `ErrorState` 그대로.

## 테스트
- hibye-web vitest: `lib/adminNav.ts`(권한별 메뉴 목록, 예전 `?tab=` → 새 주소 변환).
- nodejs-server: `checkAdminHomepage`에 summary(권한 없음 403, 건수 쿼리) 추가.
- 화면: 로그인이 필요해 Claude는 직접 못 봄 → typecheck·build·lint + 사용자 확인(각 메뉴 새로고침 유지, 뒤로가기, 모바일 선택 상자, 홈페이지 권한자 화면).
