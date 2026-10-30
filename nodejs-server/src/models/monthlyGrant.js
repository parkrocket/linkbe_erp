const pool = require('../config/dbPromise');
const BalanceLog = require('./balanceLog');
const { escapeSlack } = require('../utils/slackEscape');
const slack = require('../utils/slack'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)

// 신입 월차 자동 부여 — 링크비 방식(2026-10-30 사용자 결정):
// 입사한 해 12/31까지 매달 1일에 연차 +1, 첫 부여는 입사 후 처음 맞는 1일. 다음 해 1/1은 관리자가 일괄 덮어쓰기
// 개근 여부는 데이터가 없어 검사하지 않음 (예외는 관리자 조정)
const MonthlyGrant = {};

const SYSTEM_ACTOR = 0; // 장부의 변경자 — 시스템
const memoOf = month => `${month} 월차 자동 부여`;

// today 'YYYY-MM-DD'(KST) 기준 이번 달 몫 부여. 같은 달 두 번 실행해도 장부로 중복 방지
MonthlyGrant.run = async today => {
    const month = today.slice(0, 7);
    const memo = memoOf(month);
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // ponytail: 승인 직원 행 전체를 잠금(user_doe 인덱스 없음) — 00:05 짧은 작업이라 수용, 직원 수가 커지면 인덱스 추가
        // 올해 1/1 ≤ 입사일 < 이번 달 1일 → 12월 입사·입사 예정자는 제외, 1월은 범위가 비어 대상 없음
        const [targets] = await conn.query(
            `SELECT mb_no, cp_id, user_name, user_stip, user_vaca FROM lk_user
             WHERE user_status = 'approved' AND user_doe >= ? AND user_doe < ?
               AND (employment_type IS NULL OR employment_type IN ('regular', 'contract', 'intern'))
             FOR UPDATE`,
            [`${today.slice(0, 4)}-01-01`, `${month}-01`],
        );
        const granted = [];
        if (targets.length) {
            // 중복 판단은 시스템 변경자 + 메모 (kind는 enum 마이그레이션 누락 시 ''로 저장될 수 있어 쓰지 않음)
            const [done] = await conn.query('SELECT mb_no FROM lk_balance_log WHERE actor_mb_no = 0 AND memo = ? AND mb_no IN (?)', [
                memo,
                targets.map(t => t.mb_no),
            ]);
            const skip = new Set(done.map(d => d.mb_no));
            for (const t of targets.filter(t => !skip.has(t.mb_no))) {
                await conn.query('UPDATE lk_user SET user_stip = COALESCE(user_stip, 0) + 1 WHERE mb_no = ?', [t.mb_no]);
                await BalanceLog.insert(conn, {
                    cpId: t.cp_id,
                    mbNo: t.mb_no,
                    actorMbNo: SYSTEM_ACTOR,
                    kind: 'grant',
                    before: { stip: t.user_stip, vaca: t.user_vaca },
                    after: { stip: Number(t.user_stip ?? 0) + 1, vaca: t.user_vaca },
                    memo,
                });
                granted.push({ mbNo: t.mb_no, name: t.user_name });
            }
        }
        await conn.commit();
        return { month, granted };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// #hibye-관리 월 1회 요약 (0명이면 보내지 않음)
MonthlyGrant.notify = async ({ month, granted }) => {
    if (!granted.length) return;
    const names = granted.map(g => escapeSlack(g.name)).join(', ');
    await slack.sendSlackMessage('#hibye-관리', `${Number(month.slice(5))}월 월차 자동 부여: ${names} (${granted.length}명)`);
};

module.exports = MonthlyGrant;
