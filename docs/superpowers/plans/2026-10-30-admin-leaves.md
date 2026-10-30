# 관리자 3단계: 근태 현황·대신 취소 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Checkbox steps.

**Goal:** 관리자가 회사 전체 근태를 달력·목록으로 보고, 오늘 이후 근태를 사유와 함께 대신 취소한다.
**Spec:** `docs/superpowers/specs/2026-10-30-admin-leaves-design.md`

## Global Constraints
- 4칸, 한국어 주석, 커밋 `타입: 내용` + Co-Authored-By, 새 TSX `prettier --print-width 140`
- 관리자 API는 `req.userCpId` 범위, Slack 이스케이프, dev 서버 켜진 채 `npm run build` 금지
- push는 사용자 승인 후

## Review Focus
1. 본인 취소 회귀(소유 확인·잔여 복원·장부) — Task 1 checkApply
2. 다른 회사 근태 id로 대신 취소 → 404, 아무것도 지우지 않음 — Task 1
3. 오늘(KST) 근태는 취소 가능, 어제는 불가 — Task 1
4. 달력 월 경계(전·다음 달 날짜 칸) — Task 3 vitest

### Task 1: 대신 취소 모델 (Apply 공통 취소 함수)
Files: `nodejs-server/src/models/applyModel.js`, Test `scripts/checkApply.js`(회귀·픽스처 user_id), `scripts/checkAdminLeaves.js`(모델)
Produces: `Apply.cancelByAdmin({ id, cpId, actorMbNo, reason }) → { userName, type, md }`
- [ ] 실패 테스트 → FAIL → 공통 함수로 리팩터 + cancelByAdmin → ✅ → 커밋 `feat: 관리자 대신 취소 모델(본인 취소와 같은 처리)`

### Task 2: 관리자 근태 API
Files: `models/adminModel.js`(`listLeaves`), `controllers/adminController.js`, `routes/admin.js`, Test `scripts/checkAdminLeaves.js`(API), `checkAuth.js`
- [ ] 실패 테스트 → 구현 → ✅ → 커밋 `feat: 관리자 근태 현황 조회·대신 취소 API`

### Task 3: 화면 순수 함수
Files: `hibye-web/src/lib/adminLeaves.ts`(+test), `lib/authMessages.ts`(+test: `Leave not found`, `Past date not allowed`, `Invalid range`)
Produces: `monthRange(ym)`, `yearRange(year)`, `calendarWeeks(ym) → string[][]`, `filterLeaves(rows, filter)`, `countByType(rows)`, `groupByDate(rows)`
- [ ] 테스트 → 구현 → 커밋 `feat: hibye-web 근태 현황 계산`

### Task 4: '근태' 탭 화면
Files: `components/admin/LeavesTab.tsx`, `components/admin/adminApi.ts`, `AdminPage.tsx`
- [ ] 구현 → typecheck·lint·test → dev 서버 CSS/페이지 확인 → 커밋 `feat: hibye-web 관리 화면 근태 탭(달력·목록·대신 취소)`

### Task 5: 최종 리뷰·문서·배포 승인
