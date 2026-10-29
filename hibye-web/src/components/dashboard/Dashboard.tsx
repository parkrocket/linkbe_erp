import { Plus } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/Button';
import type { User } from '@/lib/types';
import { Greeting } from './Greeting';
import { MyLeaveCard } from './MyLeaveCard';
import { TeamLeaveCard } from './TeamLeaveCard';

// 로그인 후 '/' — 근태 중심: 인사말 + [근태 신청] → [내 근태 | 오늘 팀 근태]
export function Dashboard({ user }: { user: User }) {
    return (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:py-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <Greeting name={user.user_name} now={new Date()} />
                {/* 화면의 핵심 행동 1개 — 근태 페이지(전환 예정)로 이동 */}
                <Link href="/vaca?new=1" className={buttonClass('primary')}>
                    <Plus aria-hidden className="size-4" />
                    근태 신청
                </Link>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
                <MyLeaveCard user={user} />
                <TeamLeaveCard cpId={user.cp_id} />
            </div>
        </main>
    );
}
