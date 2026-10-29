// 기존 react-app 푸터 문구 유지 — 사업자번호·대표·전화는 예시 값으로 실제 정보 수령 후 교체 필요
export function Footer() {
    return (
        <footer className="mt-auto border-t border-line bg-white">
            <div className="mx-auto w-full max-w-6xl px-4 py-8 text-xs leading-6 text-muted">
                <p>사업자 등록번호 : 000-00-00000 | 통신판매업신고번호: 제 0000호</p>
                <p>대표 : 홍길동 | 주소 : 서울시 금천구 디지털로9길 65(가산동, 백상스타타워1차)</p>
                <p>전화 : 02--000-0000 | 이메일 : linkbe.kr</p>
                <p className="mt-2">Copyright 2024. Linkbe. All rights reserved.</p>
            </div>
        </footer>
    );
}
