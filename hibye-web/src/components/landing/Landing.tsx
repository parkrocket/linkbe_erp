import { CalendarCheck, Clock, Palmtree } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/Button';

const FEATURES = [
    { icon: Clock, title: '출퇴근', desc: 'Slack 버튼 한 번으로 출근·재택·퇴근을 기록해요.' },
    { icon: Palmtree, title: '휴가', desc: '연차·반차·휴가를 신청하고 내역을 확인해요.' },
    { icon: CalendarCheck, title: '결재', desc: '신청한 결재의 진행 상황을 한눈에 봐요.' },
];

// 로그인 전 첫 화면 — 데이터 호출 없는 정적 페이지
export function Landing() {
    return (
        <main className="flex-1">
            <section className="bg-gradient-to-b from-primary-soft to-surface">
                <div className="mx-auto w-full max-w-6xl px-4 py-20 md:py-28">
                    <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-ink md:text-5xl">
                        출근부터 휴가까지,
                        <br />
                        <span className="text-primary">hibye</span> 하나로
                    </h1>
                    <p className="mt-4 text-base text-muted md:text-lg">링크비 구성원을 위한 근태·휴가·결재 관리</p>
                    <Link href="/login" className={buttonClass('primary', 'mt-8 px-6 py-3 text-base')}>
                        시작하기
                    </Link>
                </div>
            </section>

            <section aria-label="주요 기능" className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-20 md:grid-cols-3">
                {FEATURES.map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="rounded-(--radius-card) border border-line bg-white p-6">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                            <Icon aria-hidden className="size-5" />
                        </span>
                        <h2 className="mt-4 text-base font-bold text-ink">{title}</h2>
                        <p className="mt-1 text-sm leading-6 text-muted">{desc}</p>
                    </div>
                ))}
            </section>
        </main>
    );
}
