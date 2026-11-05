import type { Metadata } from 'next';
import { HibyeLanding } from '@/components/landing/HibyeLanding';

// 새 원페이지 랜딩 시안 — 지금 메인('/')은 그대로 두고 따로 확인. 확정 전이라 검색엔진 제외
export const metadata: Metadata = {
    title: 'hibye — 링크비의 하루를 한곳에',
    description: '링크비 구성원을 위한 근태·일정·업무·관리 플랫폼',
    robots: { index: false, follow: false },
};

export default function LandingPreviewPage() {
    return <HibyeLanding />;
}
