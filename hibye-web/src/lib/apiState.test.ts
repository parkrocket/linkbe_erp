import { describe, expect, it } from 'vitest';
import { stateBeforeRefetch } from './apiState';

describe('stateBeforeRefetch', () => {
    const ok = { status: 'ok' as const, data: { users: [] } };

    it('다시 시도(reload)는 로딩 화면으로', () => {
        expect(stateBeforeRefetch(ok, false)).toEqual({ status: 'loading' });
    });

    it('조용한 새로고침(refresh)은 기존 화면 유지 — 저장 후 팝업·안내가 사라지지 않게', () => {
        expect(stateBeforeRefetch(ok, true)).toBe(ok);
    });

    it('오류 상태에서는 조용한 새로고침도 로딩으로 (빈 화면 대신)', () => {
        expect(stateBeforeRefetch({ status: 'error' }, true)).toEqual({ status: 'loading' });
    });
});
