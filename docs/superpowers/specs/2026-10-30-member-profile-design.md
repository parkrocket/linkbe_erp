# 직원 상세 팝업 + 인사 정보(부서·직급·고용형태 등) — 설계

- 작성일: 2026-10-30
- 상태: 사용자 검토 대기
- 선행: 관리자 1단계(승인·직원 관리), 2단계(연차·휴가 조정 + 잔여 장부) — 운영 배포됨

## 1. 목표와 결정 사항

관리 화면 직원 관리 탭에서 직원을 누르면 팝업으로 정보를 열람·수정하고, 부서·직급·고용형태 등 인사 정보를 관리한다. 회원가입 때 입사일·성별·생년월일을 받는다.

사용자 결정:
- 팝업 수정 항목: 이름, 연락처, 입사일, 성별, 생년월일, 부서, 직급, 고용형태, 연차·휴가 잔여
- 로그인 이메일(아이디)은 **열람만** (근태 기록이 user_id로 연결 — 변경 시 기록 끊김)
- 부서·직급: **목록에서 선택 + 관리자가 목록 관리**
- 고용형태: 정규직·계약직·인턴·프리랜서·외주(1개 값)
- 회원가입: 입사일·성별·생년월일 **필수**. 부서·직급·고용형태·잔여는 관리자가 입력
- 성별: 남성·여성

범위 밖: 직원 본인 정보 열람·수정, 정보 수정 이력 테이블(잔여만 장부), 이메일 변경.

## 2. 데이터 (마이그레이션 `nodejs-server/migrations/2026-10-30-member-profile.sql`, 사용자가 운영에서 실행)

`lk_user` 칸 추가 (모두 NULL 허용 — 기존 직원은 관리자가 채움):

| 칸 | 타입 | 값 |
|---|---|---|
| user_gender | VARCHAR(10) NULL | `male` / `female` |
| user_birth | DATE NULL | 생년월일 |
| dept_id | INT NULL | `lk_department.id` |
| position_id | INT NULL | `lk_position.id` |
| employment_type | VARCHAR(20) NULL | `regular` / `contract` / `intern` / `freelance` |

입사일은 기존 `user_doe`(DATE, Slack 홈 '나의 입사일·총 근로일'이 사용) 그대로.

새 테이블 `lk_department`, `lk_position` (구조 동일):

| 칸 | 타입 |
|---|---|
| id | INT AUTO_INCREMENT PK |
| cp_id | INT NOT NULL |
| name | VARCHAR(50) NOT NULL |
| sort_order | INT NOT NULL DEFAULT 0 |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP |

- `UNIQUE (cp_id, name)` — 같은 회사 안 이름 중복 불가
- 직원에는 번호로 연결 → 이름 변경이 모든 직원에게 즉시 반영
- 외래 키 제약은 두지 않음(기존 스키마에 없음) — 삭제 시 사용 여부는 앱이 검사
- 컬럼·테이블 추가만이라 코드 배포 전에 실행해도 기존 기능에 영향 없음. **코드 배포 전에 실행**

## 3. 서버

### 3.1 인사 정보 검증 (`utils/profileValidation.js`)
`validateProfile(body) → { error } | { value }` — 팝업 저장용, 모든 항목을 한 번에 받음(전체 덮어쓰기):
- name: trim 1~50자 → `Invalid name` / phone: `^[0-9-]{10,13}$` → `Invalid phone` (가입 규칙과 동일, 공용 상수로)
- doe(입사일)·birth: `YYYY-MM-DD` 실존 날짜 또는 null. birth는 1900-01-01 이상·오늘(KST) 이하 → `Invalid birth`, doe는 1900-01-01 이상·오늘+365일 이하 → `Invalid doe`
- gender: `male`/`female`/null → `Invalid gender`
- employmentType: 4개 코드/null → `Invalid employment type`
- deptId·positionId: 양의 정수/null → `Invalid department`/`Invalid position` (같은 회사 목록 존재 여부는 컨트롤러에서 확인, 없으면 같은 사유)

### 3.2 API (`/api/admin`, requireAuth + requireAdmin, 같은 회사만)
- `GET /users/:mbNo` → `{ user }`: 1단계 SAFE 컬럼 + `user_email, user_doe, user_gender, user_birth, dept_id, position_id, employment_type, user_stip, user_vaca` (날짜는 `DATE_FORMAT(..., '%Y-%m-%d')`로 문자열). 없으면 404
- `POST /users/:mbNo/profile` 바디 `{ name, phone, doe, gender, birth, deptId, positionId, employmentType }` → `{ ok: true }`
  - 관리자 본인 정보도 수정 가능(상태·권한과 달리 위험 없음)
  - 바뀐 항목이 있을 때만 UPDATE, `#hibye-관리`: `{관리자}님이 {직원}님 정보를 수정했어요 (이름·부서)` — 바뀐 항목 이름만, 값은 넣지 않음(개인정보). Slack 실패는 응답에 영향 없음
- 잔여 수정은 기존 `POST /balances`(단일 항목, 사유 필수, 장부 기록) 재사용
- 조직: `GET /org` → `{ departments: [{id,name,sort_order,member_count}], positions: [...] }` (sort_order, id 순)
  - `POST /org/:kind` (`kind` = `departments`|`positions`) `{ name }` → 생성, 맨 뒤 순서. 이름 trim 1~50자 → `Invalid name`, 중복 → 409 `Duplicate name`
  - `POST /org/:kind/:id` `{ name }` 이름 변경 / `POST /org/:kind/:id/move` `{ direction: 'up'|'down' }` 이웃과 sort_order 교환
  - `DELETE /org/:kind/:id` → 소속 직원 있으면 409 `In use`
  - 다른 회사 id → 404 `Not found`

### 3.3 회원가입 (`utils/registerValidation.js`, `User.create`)
- 새 항목 `doe`, `gender`, `birth`를 **서버에서도 필수**로 검사(3.1과 같은 형식 규칙, null 불가) → `Invalid doe`/`Invalid gender`/`Invalid birth`, 저장
- 기존 react-app 가입 화면은 이 항목을 보내지 않아 가입이 실패함 — 사용자 확인(2026-10-30): 당분간 가입 인원 없음, 전환일에 react-app 퇴역

## 4. 화면 (hibye-web)

- 직원 관리 탭: 행(이름 영역) 클릭/Enter → `MemberDialog` 팝업. 행의 기존 승인·비활성화·권한 버튼은 그대로
- 팝업: 상단 열람(이메일·가입일·상태·권한 배지) / 수정 폼(이름, 연락처, 입사일 `type=date`, 성별 라디오, 생년월일 `type=date`, 부서·직급 `select`(목록 없으면 "조직 탭에서 먼저 추가해 주세요"), 고용형태 `select`, 각 '선택 안 함' 가능) / 저장
  - 연차·휴가: 팝업 아래 별도 영역(숫자 2칸 + 사유 + 저장) — 2단계 `saveBalances` 재사용, `Balance changed` 안내 동일
- 새 탭 **조직**: 부서·직급 두 목록, 각 항목 이름 수정·▲▼·삭제(소속 인원 표시, 사용 중이면 삭제 버튼 대신 안내), 추가 입력칸
- 회원가입: 입사일·성별·생년월일 필수 입력 추가, 동의 문구 수집 항목에 `생년월일·성별·입사일` 추가
- 순수 함수(vitest): `lib/profile.ts` — 폼 검사 `validateProfileForm`, 서버 응답 → 폼 값 변환, 고용형태·성별 라벨. `lib/register.ts`에 새 항목 검사 추가

## 5. 보안·개인정보

- 성별·생년월일은 관리자 API(`/api/admin/*`)에서만 응답, 같은 회사만. 직원 본인 API(`/users/auth` 등)·팀 근태 응답에 추가하지 않음
- Slack 기록에 값(생년월일 등) 미포함, 이름은 `escapeSlack`
- 모든 SQL 파라미터 바인딩, 조직 `kind`는 고정 표(`departments→lk_department`)에서만 테이블명 결정

## 6. 테스트

- `scripts/checkProfile.js`: validateProfile 각 사유·경계(오늘, 1900-01-01, 존재하지 않는 날짜 2026-02-30), 다른 회사 부서 id → `Invalid department`, 바뀐 항목만 UPDATE·Slack 항목명, 값 미포함, 상세 응답에 비밀번호 없음·회사 범위
- `scripts/checkOrg.js`: 생성·중복 409·이름 변경·순서 교환·사용 중 삭제 409·다른 회사 404·`kind` 화이트리스트
- `scripts/checkRegister.js` 보강: 새 항목 누락·형식 오류 각 사유, 저장 값
- `checkAuth.js`: `/api/admin/org`, `/api/admin/users/1` 무인증 401
- hibye-web vitest: `validateProfileForm`, 가입 새 항목 검사

## 7. 위험

- 기존 react-app 가입 화면은 새 필수 항목 때문에 실패(3.3, 사용자 수용)
- 부서 삭제와 동시 배정 경쟁 — 드묾, 발생 시 직원의 dept_id가 없는 id를 가리킴 → 화면은 '선택 안 함'으로 표시(목록에 없는 id 처리)
- 개인정보 항목 추가 → 동의 문구 회사 정책 확인 필요(1단계 확인 항목과 함께)
