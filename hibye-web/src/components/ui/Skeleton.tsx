// 로딩 중 빈 화면 대신 보여주는 회색 틀
export function Skeleton({ className = '' }: { className?: string }) {
    return <div aria-hidden className={`animate-pulse rounded-md bg-line ${className}`} />;
}
