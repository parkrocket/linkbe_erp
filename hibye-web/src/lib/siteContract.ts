// 계약 관리 화면 공용 규칙 (API 응답 칸 이름은 서버 workSiteContractController 그대로)
import type { BadgeTone } from '@/components/ui/Badge';

export const STATUS_LABEL = { run: '진행', stop: '종료' } as const;
export type SiteContractStatus = keyof typeof STATUS_LABEL;

export type SiteContract = {
    id: number;
    code: string;
    companyName: string;
    siteUrl: string;
    startDate: string | null;
    endDate: string | null;
    status: SiteContractStatus;
    email: string;
    memo: string;
    updatedAt: string; // 동시 수정 검사용
};

// 만료 임박 기준(일)
export const SOON_DAYS = 60;

// 종료일까지 남은 날 수 — 날짜 문자열(YYYY-MM-DD)끼리 계산해 시간대 영향 없음. 종료일이 없으면 null
export const daysLeft = (endDate: string | null, today: string): number | null =>
    endDate ? Math.round((Date.parse(endDate) - Date.parse(today)) / 86_400_000) : null;

// 진행 중 계약의 남은 기간 표시 — 지남(빨강)·임박(주황)·여유(회색). 종료된 계약·종료일 없는 계약은 표시 없음
export function leftBadge(c: Pick<SiteContract, 'status' | 'endDate'>, today: string): { tone: BadgeTone; text: string } | null {
    const left = daysLeft(c.endDate, today);
    if (c.status !== 'run' || left === null) return null;
    if (left < 0) return { tone: 'rejected', text: `${-left}일 지남` };
    if (left === 0) return { tone: 'rejected', text: '오늘 만료' };
    return { tone: left <= SOON_DAYS ? 'pending' : 'neutral', text: `${left}일 남음` };
}
