# 관리자 기능 1단계: 권한·가입 승인·직원 관리·회원가입 설계

- 작성일: 2026-10-30
- 상태: 승인됨 (구현 계획 작성 전)
- 상위 결정: 회원가입은 관리자 승인 방식. 관리자 기능은 3단계로 진행 — **1단계(이 문서) = 권한·승인 기반 + 가입 승인 + 직원 관리 + 회원가입 화면**, 2단계 = 연차·휴가 일수 조정(변경 이력 포함), 3단계 = 전체 근태 조회·대신 취소

## 1. 배경
- 지금은 누구나 공개 회원가입으로 회사를 골라 즉시 직원이 되고, 로그인하면 동료 근태(이름 포함)를 보고 근태를 신청할 수 있다.
- 시스템에 관리자 개념이 없다(lk_user에 권한·상태 컬럼 없음).
- 회원가입 서버 검증이 없다(비밀번호 규칙·이메일 형식은 화면에서만 검사, 중복 이메일은 DB 오류로 노출).

## 2. 데이터

`lk_user`에 컬럼 2개 추가 (기존 데이터는 변경하지 않음):

| 컬럼 | 타입 | 기본값 | 값 |
|---|---|---|---|
| `user_role` | VARCHAR(20) NOT NULL | `'member'` | `member`, `admin` |
| `user_status` | VARCHAR(20) NOT NULL | `'approved'` | `pending`, `approved`, `rejected`, `inactive` |

- 기본값이 `approved`라 기존 직원은 자동으로 승인 상태. 새 가입만 명시적으로 `pending`으로 저장.
- 첫 관리자 1명은 마이그레이션 직후 서버에서 직접 `user_role='admin'` 지정 (이메일은 저장소에 기록하지 않음).
- 마이그레이션 전 `lk_user` 백업(mysqldump). 되돌리기: 두 컬럼 DROP.
- 사용자 식별은 기존과 같이 `user_id`(이메일). 관리자 API의 대상 지정은 숫자 PK `mb_no`.

## 3. 인증·접근 규칙

| 상황 | 동작 |
|---|---|
| 로그인 — `approved` | 지금과 동일 |
| 로그인 — `pending` / `rejected` / `inactive` | **200 + `loginSuccess:false`** + `error` 사유(`Pending approval` / `Registration rejected` / `Account inactive`), 토큰·쿠키 미발급 — 기존 로그인 API의 실패 응답 형식 유지(기존 react-app이 이 형식에서만 오류 alert를 띄움) |
| 이미 로그인한 사용자가 `inactive`·`rejected`로 바뀜 | `requireAuth`가 매 요청 DB에서 상태 확인 → 다음 요청부터 401 (토큰 24시간 만료를 기다리지 않음) |
| `/api/admin/*` | `requireAdmin`: 로그인 + `approved` + `admin`이 아니면 403 |
| Slack 근태 신청 | `Apply.insertMany`가 신청자 상태 확인 — `approved`가 아니면 거절(`Account not approved`) |
| `/api/users/auth` | 응답 사용자 정보에 `user_role`, `user_status` 포함(비밀번호 해시는 계속 제거) |

- `requireAuth`는 `req.userId`에 더해 `req.userRole`을 설정한다.
- 상태 조회는 매 요청 1회(인덱스 PK 조회). 직원 수가 적어 성능 영향 무시 가능.

## 4. 회원가입

### 화면 `/register` (hibye-web)
- 입력: 이메일, 비밀번호, 비밀번호 확인, 이름, 휴대폰 번호, 회사(목록이 1개면 자동 선택·숨김), 개인정보 수집·이용 동의(필수 체크)
  - 동의 문구는 회사 정책 검토 필요 — 초안으로 "수집 항목: 이메일·이름·휴대폰 번호 / 목적: 사내 근태 관리 / 보유 기간: 퇴사 시까지"
- 클라이언트 검증(즉시 안내) + 서버 검증(최종). 규칙은 기존과 동일:
  - 이메일 형식, 비밀번호 8~15자·영문 포함·숫자 또는 특수문자 포함, 비밀번호 확인 일치, 이름 필수, 휴대폰 숫자·하이픈 10~13자
- 완료 화면: "가입 신청이 완료됐어요. 관리자 승인 후 로그인할 수 있어요." + [로그인 화면으로]

### API `POST /api/users/register` (공개)
- 입력: `email, password, name, phone, cpId`
- 검증 실패 400(`Invalid email` / `Invalid password` / `Invalid name` / `Invalid phone` / `Invalid company`)
- 이미 있는 이메일: 상태가 `rejected`면 409 `Registration rejected`, 그 외 409 `Email already registered`
- 저장: `user_status='pending'`, `user_role='member'`
- 성공 후 Slack `#hibye-관리`: "{이름}님이 가입 승인을 기다리고 있어요 → https://hibye.kr/admin" (알림 실패는 가입 결과에 영향 없음, 기록만)

## 5. 관리자 화면 `/admin` (hibye-web)

- 헤더 메뉴 "관리" — `admin`에게만 표시, 승인 대기 인원 숫자 배지
- 서버 컴포넌트에서 `admin` 확인, 아니면 `/`로 이동. `proxy.ts` 보호 경로에 `/admin` 추가.

### 가입 승인 탭
- 목록: 이름, 이메일, 휴대폰, 가입일 (`pending`만)
- [승인] → `approved`, [거절] → 확인 창 후 `rejected`

### 직원 관리 탭
- 목록: 이름, 이메일, 상태 배지, 권한 배지, 가입일 (상태 필터: 전체/승인/비활성/거절/대기)
- 동작: [비활성화](approved→inactive), [다시 활성화](inactive·rejected→approved), [관리자로 지정](member→admin), [관리자 해제](admin→member)
- 안전장치(서버에서 검사, 화면은 버튼 비활성 + 이유 안내):
  - 자기 자신은 비활성화·관리자 해제 불가 → 409 `Cannot change yourself`
  - `approved` 관리자가 1명만 남으면 그 사람의 관리자 해제·비활성화 불가 → 409 `Last admin`

### API (`requireAdmin`)
| 메서드·경로 | 동작 |
|---|---|
| `GET /api/admin/users?status=` | 직원 목록 (안전한 컬럼만: mb_no, user_id, user_name, user_phone, user_role, user_status, user_datetime) |
| `GET /api/admin/summary` | `{ pendingCount }` (헤더 배지) |
| `POST /api/admin/users/:mbNo/status` body `{ status }` | 상태 변경 (허용 전이만: pending→approved/rejected, approved→inactive, inactive/rejected→approved) — 그 외 400 `Invalid transition` |
| `POST /api/admin/users/:mbNo/role` body `{ role }` | 권한 변경 |

- 같은 회사(`cp_id`) 직원만 조회·변경 (다른 회사 대상 404)
- 모든 변경은 Slack `#hibye-관리`에 기록: "{관리자}님이 {대상}님을 {승인/거절/비활성화/다시 활성화/관리자로 지정/관리자 해제}했어요"

## 6. 기존 react-app과의 호환
- 기존 로그인 화면은 `loginSuccess:false`일 때 서버 `error` 문자열을 alert로 보여준다 → 사유가 영문으로 보임(전환 전 한시적). 별도 수정하지 않음. hibye-web 로그인은 사유별 한국어 안내.
- 기존 회원가입 화면은 가입 후 `/login`으로 이동 → 승인 전 로그인 시도 시 `Pending approval` 안내.

## 7. 테스트
- nodejs-server 점검 스크립트(DB·Slack 가짜):
  - 로그인 상태별 loginSuccess:false 사유/성공, requireAuth의 비활성 즉시 차단, requireAdmin 403
  - 회원가입 검증 400들, 중복 409 2종, pending 저장, 알림은 성공 후
  - 상태 전이 허용/거부, 자기 자신·마지막 관리자 보호, 다른 회사 404, Slack 기록
  - Slack 근태 신청: 미승인 사용자 거절
- hibye-web vitest: 회원가입 클라이언트 검증 함수, 관리자 오류 사유 → 안내 문구
- 화면: 회원가입·관리자 화면 PC/모바일 캡처 확인, 실계정 승인 흐름은 사용자 확인

## 8. 운영 반영 순서
1. `lk_user` 백업 → 컬럼 추가 마이그레이션 → 첫 관리자 지정 (사용자가 서버에서 실행, 명령은 계획에서 제공)
2. nodejs-server 배포 (컬럼이 먼저 있어야 함 — 순서 중요)
3. hibye-web 배포
4. Slack 봇을 `#hibye-관리`에 초대 (사용자)

## 범위 밖
연차·휴가 일수 조정과 변경 이력(2단계), 전체 근태 조회·대신 취소(3단계), 비밀번호 찾기·변경, 이메일 인증.
