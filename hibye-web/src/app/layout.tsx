import type { Metadata } from 'next';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import './globals.css';

export const metadata: Metadata = {
    title: 'hibye — 링크비 구성원 관리 플랫폼',
    description: '링크비 구성원을 위한 근태·휴가·결재 관리',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
    return (
        <html lang="ko">
            <head>
                {/* Pretendard 가변 폰트 (CDN) */}
                <link
                    rel="stylesheet"
                    href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css"
                />
            </head>
            <body className="flex min-h-screen flex-col">
                <Header />
                {children}
                <Footer />
            </body>
        </html>
    );
}
