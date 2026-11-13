// 관리 대시보드 — 날짜 계산(이번 주·기념일)과 연차 사용 비율. 날짜는 'YYYY-MM-DD' 문자열끼리 계산해 시간대 영향 없음
import { addDays } from './calendar';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

// '11/13 (금)'
export const dayLabel = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))} (${WEEKDAYS[weekdayOf(date)]})`;

// 오늘이 든 주의 월~금 (근태는 주말 신청이 없어 평일만)
export function weekdaysOf(today: string): string[] {
    const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
    return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
}

// GET /api/admin/anniversaries 응답 항목 — 생일은 월-일만(태어난 해는 서버가 내보내지 않음)
export type AnniversaryUser = { mbNo: number; name: string; deptId: number | null; joinDate: string | null; birthMd: string | null };
export type Anniversary = { date: string; mbNo: number; name: string; kind: 'birth' | 'join'; years?: number };

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
// 월-일('MM-DD')이 오늘 이후(오늘 포함) 처음 돌아오는 날짜. 2/29는 평년에 2/28로
function nextOccurrence(md: string, today: string): string {
    const year = Number(today.slice(0, 4));
    const on = (y: number) => (md === '02-29' && !isLeap(y) ? `${y}-02-28` : `${y}-${md}`);
    return on(year) >= today ? on(year) : on(year + 1);
}

// 오늘부터 days일 안의 생일·입사 기념일(1주년부터), 날짜순
export function upcomingAnniversaries(users: AnniversaryUser[], today: string, days = 30): Anniversary[] {
    const until = addDays(today, days);
    const out: Anniversary[] = [];
    for (const u of users) {
        if (u.birthMd) {
            const date = nextOccurrence(u.birthMd, today);
            if (date <= until) out.push({ date, mbNo: u.mbNo, name: u.name, kind: 'birth' });
        }
        if (u.joinDate) {
            const date = nextOccurrence(u.joinDate.slice(5), today);
            const years = Number(date.slice(0, 4)) - Number(u.joinDate.slice(0, 4));
            if (date <= until && years > 0) out.push({ date, mbNo: u.mbNo, name: u.name, kind: 'join', years });
        }
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name, 'ko')));
}

// 남은 연차가 이 값 이하면 '얼마 안 남음' 표시
export const LOW_LEAVE_DAYS = 3;

// 연차 막대 — 사용·예정·남음 비율(%). 남음(user_stip)은 예정분이 이미 빠진 값이라 셋의 합이 올해 전체
export function leaveUsage(row: { user_stip: number | null; used_stip?: number; planned_stip?: number }) {
    const used = Math.max(0, row.used_stip ?? 0);
    const planned = Math.max(0, row.planned_stip ?? 0);
    const left = Math.max(0, row.user_stip ?? 0);
    const total = used + planned + left;
    const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
    return { used, planned, left, usedPct: pct(used), plannedPct: pct(planned), low: left <= LOW_LEAVE_DAYS };
}
