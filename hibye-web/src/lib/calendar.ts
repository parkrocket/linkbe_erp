// 월 달력 계산 — 근태 현황(관리)·일정 화면 공용. 'YYYY-MM-DD'는 UTC 날짜로 계산(시간대 영향 없음)

const pad = (n: number) => String(n).padStart(2, '0');
// 'YYYY-MM-DD' 계산은 UTC 날짜로 (시간대 영향 없음)
export const toDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function monthRange(ym: string) {
    const [y, m] = ym.split('-').map(Number);
    return { from: `${ym}-01`, to: toDate(new Date(Date.UTC(y, m, 0))) }; // 다음 달 0일 = 이번 달 말일
}

export const yearRange = (year: number) => ({ from: `${year}-01-01`, to: `${year}-12-31` });

export function shiftMonth(ym: string, delta: number) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

// 달력 칸 — 일요일 시작, 1일 앞과 말일 뒤는 이웃 달 날짜로 채운 주 단위 배열
export function calendarWeeks(ym: string): string[][] {
    const { from, to } = monthRange(ym);
    const start = new Date(`${from}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const end = new Date(`${to}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
    const weeks: string[][] = [];
    for (const d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        if (d.getUTCDay() === 0) weeks.push([]);
        weeks[weeks.length - 1].push(toDate(d));
    }
    return weeks;
}

// 'YYYY-MM-DD' + n일
export const addDays = (date: string, n: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return toDate(d);
};
