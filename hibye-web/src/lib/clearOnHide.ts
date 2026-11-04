import { useEffect } from 'react';

type VisibilityDoc = Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;

// 탭이 숨겨지면(hidden) clear, 끝낼 때(effect cleanup)도 clear — 해제 함수를 돌려줌
export function watchHide(doc: VisibilityDoc, clear: () => void): () => void {
    const onChange = () => {
        if (doc.visibilityState === 'hidden') clear();
    };
    doc.addEventListener('visibilitychange', onChange);
    return () => {
        doc.removeEventListener('visibilitychange', onChange);
        clear();
    };
}

// 화면에 둔 평문 지우기 — 탭 전환 시, 화면을 떠날 때
// Next 16 cacheComponents는 떠난 화면을 언마운트하지 않고 숨긴 <Activity>로 보관(effect cleanup만 돎)하므로 state를 직접 비워야 함
// clear는 바뀌지 않는 함수(useCallback)로 넘길 것
export function useClearOnHide(clear: () => void) {
    useEffect(() => watchHide(document, clear), [clear]);
}
