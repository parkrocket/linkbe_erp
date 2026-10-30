# 신입 월차 자동 부여 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 입사 연도 신입에게 매달 1일 연차 +1을 자동 부여하고 장부(kind grant)에 기록한다.
**Architecture:** `models/monthlyGrant.js`(트랜잭션·중복 방지) + `controllers/userCron.js`에 월 1일 스케줄과 시작 시 실행. 화면은 라벨만.
**Spec:** `docs/superpowers/specs/2026-10-30-monthly-leave-design.md`

## Global Constraints
- 4칸 들여쓰기, 한국어 주석, 커밋 `타입: 내용` + Co-Authored-By. memo 형식 `YYYY-MM 월차 자동 부여`, 시스템 actor 0
- push는 사용자가 마이그레이션(인사 정보 + grant) 실행 후 승인 시

## Review Focus
1. 서버 재시작이 같은 달에 여러 번 → 중복 부여 없음 — Task 1
2. 서버 시계 UTC: 1일 00:05 KST 스케줄·'오늘' 계산 — Task 1(`kstToday`)·Task 2(timezone 옵션)
3. user_stip NULL 직원 → 1 — Task 1

### Task 1: 부여 로직
**Files:** Create `nodejs-server/migrations/2026-10-30-balance-log-grant.sql`, `nodejs-server/src/models/monthlyGrant.js`; Test `nodejs-server/scripts/checkMonthlyGrant.js`
**Produces:** `MonthlyGrant.run(today: 'YYYY-MM-DD') → Promise<{ month, granted: [{ mbNo, name }] }>`, `MonthlyGrant.notify(result) → Promise<void>`
- [ ] 실패 테스트 → FAIL → 구현 → ✅ → 커밋 `feat: 신입 월차 자동 부여 로직(입사 연도, 월 1회, 장부 기록)`

### Task 2: 스케줄·화면 라벨
**Files:** Modify `nodejs-server/src/controllers/userCron.js`, `hibye-web/src/lib/balance.ts`, `hibye-web/src/components/admin/BalanceHistory.tsx`
- [ ] `cron.schedule('5 0 1 * *', job, { timezone: 'Asia/Seoul' })` + 시작 시 `job()` 1회(실패는 로그만). 테스트: userCron 로드 시 schedule 인자 확인(node-cron 가짜)
- [ ] `LOG_KIND_LABEL.grant = '자동 부여'`, 변경자 null + grant → '자동' (vitest)
- [ ] 커밋 `feat: 월차 자동 부여 스케줄과 이력 라벨`

### Task 3: 문서·운영 — CLAUDE.md/CLAUDE.local.md, 마이그레이션 스크립트에 grant 추가 안내, 사용자 실행 → 확인 → 승인 후 push
