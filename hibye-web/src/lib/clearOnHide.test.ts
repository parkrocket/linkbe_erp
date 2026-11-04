import { describe, expect, it, vi } from 'vitest';
import { watchHide } from './clearOnHide';

// 가짜 document — visibilityState만 바꿔 가며 이벤트 발생
const fakeDoc = () => {
    const target = new EventTarget();
    const doc = Object.assign(target, { visibilityState: 'visible' as DocumentVisibilityState });
    const fire = (state: DocumentVisibilityState) => {
        doc.visibilityState = state;
        doc.dispatchEvent(new Event('visibilitychange'));
    };
    return { doc: doc as unknown as Document, fire };
};

describe('watchHide', () => {
    it('탭이 숨겨질 때만 지움, 다시 보일 때는 안 지움', () => {
        const { doc, fire } = fakeDoc();
        const clear = vi.fn();
        watchHide(doc, clear);
        fire('visible');
        expect(clear).not.toHaveBeenCalled();
        fire('hidden');
        expect(clear).toHaveBeenCalledTimes(1);
    });

    it('해제(화면 떠남)하면 지우고, 그 뒤 이벤트는 무시', () => {
        const { doc, fire } = fakeDoc();
        const clear = vi.fn();
        const stop = watchHide(doc, clear);
        stop();
        expect(clear).toHaveBeenCalledTimes(1);
        fire('hidden');
        expect(clear).toHaveBeenCalledTimes(1);
    });
});
