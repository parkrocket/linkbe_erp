// 사업자 정보 — 공용 푸터와 새 랜딩 푸터가 함께 씀 (통신판매업 신고번호·이메일은 받으면 추가)
export const BUSINESS_INFO = [
    '사업자 등록번호 : 247-47-00369 | 대표 : 조인호',
    '주소 : 서울특별시 영등포구 양평로 22길 21 | 전화 : 02-6925-1774',
];
// 연도는 고정 — cacheComponents에서 정적 화면의 new Date()는 빌드 오류
export const COPYRIGHT = 'Copyright 2026. Linkbe. All rights reserved.';

export function Footer() {
    return (
        <footer className="mt-auto border-t border-line bg-white">
            <div className="mx-auto w-full max-w-page px-4 py-8 text-xs leading-6 text-muted">
                {BUSINESS_INFO.map(line => (
                    <p key={line}>{line}</p>
                ))}
                <p className="mt-2">{COPYRIGHT}</p>
            </div>
        </footer>
    );
}
