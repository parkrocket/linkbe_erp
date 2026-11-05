// 새 랜딩 기능 카드 안의 작은 화면 목업 — 실제 화면을 닮은 장식(이미지 대신 코드, 데이터는 예시)
// 내용은 카드 글이 설명하므로 화면 낭독기에는 숨김(aria-hidden)

// 근태: Slack 앱 신청 창 + 채널 알림
export function SlackApplyMock() {
    return (
        <div aria-hidden className="grid gap-3 text-[13px] sm:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-lp-line bg-lp-bg p-4">
                <p className="font-bold text-lp-text">근태 신청</p>
                <p className="mt-3 text-xs text-lp-muted">종류</p>
                <div className="mt-1 rounded-lg border border-lp-line px-3 py-2 text-lp-text">연차</div>
                <p className="mt-3 text-xs text-lp-muted">날짜</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                    {['11/20 목', '11/21 금'].map(d => (
                        <span key={d} className="rounded-md bg-primary/30 px-2 py-1 text-lilac">
                            {d}
                        </span>
                    ))}
                </div>
                <p className="mt-3 text-xs text-lp-muted">
                    남은 연차 <span className="text-lp-text">7.5일</span> → <span className="text-lp-text">5.5일</span>
                </p>
                <div className="mt-4 flex justify-end">
                    <span className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-white">신청</span>
                </div>
            </div>
            <div className="flex flex-col justify-end gap-2">
                <div className="rounded-2xl border border-lp-line bg-lp-bg p-3">
                    <p className="text-xs text-lp-muted"># 근태 알림</p>
                    <p className="mt-1 text-lp-text">김링크님이 11/20, 11/21 연차를 신청했어요.</p>
                </div>
                <div className="rounded-2xl border border-lp-line bg-lp-bg p-3">
                    <p className="text-xs text-lp-muted">Google 캘린더</p>
                    <p className="mt-1 text-lp-text">김링크 연차 · 11/20 – 11/21</p>
                </div>
            </div>
        </div>
    );
}

// 일정: 한 달 달력 — 공휴일·연차·재택 점
const DAY_MARKS: Record<number, string> = { 3: 'bg-dusk', 9: 'bg-dusk', 12: 'bg-lilac', 18: 'bg-teal-500', 20: 'bg-lilac', 21: 'bg-lilac', 26: 'bg-teal-500' };
export function CalendarMock() {
    // 11월 1일이 토요일인 달 — 앞 빈칸 6개
    const cells = [...Array(6).fill(null), ...Array.from({ length: 30 }, (_, i) => i + 1)];
    return (
        <div aria-hidden className="text-[11px]">
            <div className="grid grid-cols-7 gap-1 text-center text-lp-muted">
                {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                    <span key={d}>{d}</span>
                ))}
                {cells.map((day, i) => (
                    <span key={i} className={`flex h-7 flex-col items-center justify-center rounded-md ${day === 20 ? 'bg-primary text-white' : 'text-lp-text/80'}`}>
                        {day}
                        {day && DAY_MARKS[day] && <span className={`mt-0.5 size-1 rounded-full ${DAY_MARKS[day]}`} />}
                    </span>
                ))}
            </div>
            <div className="mt-3 flex gap-3 text-lp-muted">
                <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-dusk" />공휴일</span>
                <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-lilac" />연차</span>
                <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-teal-500" />재택</span>
            </div>
        </div>
    );
}

// 업무: 경비·견적·매출 목록
const WORK_ROWS = [
    { kind: '경비', title: '고객사 미팅 택시비', amount: '12,000원', state: '승인 대기' },
    { kind: '견적', title: '홈페이지 리뉴얼', amount: '3,300,000원', state: '발송' },
    { kind: '매출', title: '11월 유지보수', amount: '1,100,000원', state: '입금' },
];
export function WorkMock() {
    return (
        <ul aria-hidden className="divide-y divide-lp-line rounded-2xl border border-lp-line bg-lp-bg text-[13px]">
            {WORK_ROWS.map(r => (
                <li key={r.kind} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-9 shrink-0 text-xs text-lp-muted">{r.kind}</span>
                    <span className="min-w-0 flex-1 truncate text-lp-text">{r.title}</span>
                    <span className="shrink-0 tabular-nums text-lp-text">{r.amount}</span>
                    <span className="hidden shrink-0 rounded-full border border-lp-line px-2 py-0.5 text-[11px] text-lilac sm:inline">{r.state}</span>
                </li>
            ))}
        </ul>
    );
}

// 관리: 가입 승인 대기
export function AdminMock() {
    return (
        <ul aria-hidden className="space-y-2 text-[13px]">
            {[
                { name: '박하이', team: '개발팀 · 2026-11-03 입사' },
                { name: '이바이', team: '디자인팀 · 2026-11-10 입사' },
            ].map(p => (
                <li key={p.name} className="flex items-center gap-3 rounded-2xl border border-lp-line bg-lp-bg px-4 py-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/40 text-xs font-bold text-white">{p.name[0]}</span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-lp-text">{p.name}</span>
                        <span className="block truncate text-xs text-lp-muted">{p.team}</span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white">승인</span>
                </li>
            ))}
        </ul>
    );
}
