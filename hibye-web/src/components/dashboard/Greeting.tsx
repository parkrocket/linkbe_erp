// 날짜는 한국 시간 고정 — 서버(UTC)와 브라우저 결과가 같아 서버에서 바로 렌더링
const DATE_LABEL = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
});

export function Greeting({ name, now }: { name: string; now: Date }) {
    return (
        <div>
            <p className="text-sm text-muted">{DATE_LABEL.format(now)}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{name}님, 좋은 하루예요 👋</h1>
        </div>
    );
}
