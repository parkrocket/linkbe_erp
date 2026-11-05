import type { Metadata } from 'next';
import { HibyeLanding } from '@/components/landing/HibyeLanding';

// 새 랜딩 밝은 테마 시안 — 어두운 테마(/landing)와 같은 구성, 색만 다름. 검색엔진 제외
export const metadata: Metadata = {
    title: 'hibye — 링크비의 하루를 한곳에',
    description: '링크비 구성원을 위한 근태·일정·업무·관리 플랫폼',
    robots: { index: false, follow: false },
};

export default function LandingLightPreviewPage() {
    return <HibyeLanding theme="light" />;
}
