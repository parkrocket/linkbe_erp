import type { User } from '@/lib/types';
import { ComingSoonCard } from './ComingSoonCard';
import { CompanyStatusCard } from './CompanyStatusCard';
import { Greeting } from './Greeting';
import { TodayWorkCard } from './TodayWorkCard';

// 로그인 후 '/' — 인사말 → [오늘 근무 | 결재] → 회사 근무 현황 → 공지사항
export function Dashboard({ user }: { user: User }) {
    return (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:py-10">
            <Greeting name={user.user_name} now={new Date()} />
            <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <TodayWorkCard userId={user.user_id} />
                <ComingSoonCard title="결재" />
                <div className="lg:col-span-2">
                    <CompanyStatusCard cpId={user.cp_id} />
                </div>
                <div className="lg:col-span-2">
                    <ComingSoonCard title="공지사항" />
                </div>
            </div>
        </main>
    );
}
