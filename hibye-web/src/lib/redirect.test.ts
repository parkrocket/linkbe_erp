import { describe, expect, it } from 'vitest';
import { safeRedirect } from './redirect';

describe('safeRedirect', () => {
    it('내부 경로는 그대로 돌려준다', () => {
        expect(safeRedirect('/work')).toBe('/work');
        expect(safeRedirect('/calendar?m=10')).toBe('/calendar?m=10');
    });

    it('값이 없으면 홈으로', () => {
        expect(safeRedirect(null)).toBe('/');
        expect(safeRedirect('')).toBe('/');
    });

    it('외부로 나가는 주소는 홈으로 (오픈 리다이렉트 차단)', () => {
        expect(safeRedirect('//evil.com')).toBe('/');
        expect(safeRedirect('https://evil.com')).toBe('/');
        expect(safeRedirect('/\\evil.com')).toBe('/');
        expect(safeRedirect('evil.com')).toBe('/');
    });
});
