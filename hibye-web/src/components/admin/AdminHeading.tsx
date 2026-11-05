// 관리 화면마다 위쪽 제목 + 한 줄 설명
export function AdminHeading({ title, desc }: { title: string; desc?: string }) {
    return (
        <div className="mb-4">
            <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
            {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
        </div>
    );
}
