import { describe, expect, it } from 'vitest';
import { canManageHomepage, kstInput, validatePopupForm, validatePostForm, type PopupForm, type PostForm } from './homepage';

describe('canManageHomepage', () => {
    it('관리자 또는 홈페이지 권한자', () => {
        expect(canManageHomepage({ user_role: 'admin', homepage_access: 0 })).toBe(true);
        expect(canManageHomepage({ user_role: 'member', homepage_access: 1 })).toBe(true);
        expect(canManageHomepage({ user_role: 'member', homepage_access: 0 })).toBe(false);
        expect(canManageHomepage({ user_role: 'member' })).toBe(false);
    });
});

describe('kstInput', () => {
    it('서버 시각(ISO) → 한국 시간 입력값', () => {
        expect(kstInput('2026-11-04T15:00:00.000Z')).toBe('2026-11-05T00:00');
        expect(kstInput('')).toBe('');
    });
});

describe('validatePostForm', () => {
    const post: PostForm = { title: '공지', bodyHtml: '<p>a</p>', isVisible: true, client: '', category: '', siteUrl: '', showOnMain: false, sortOrder: '0', thumbnailFileId: null };

    it('제목 필수·200자', () => {
        expect(validatePostForm(post)).toEqual({});
        expect(validatePostForm({ ...post, title: ' ' }).title).toBe('제목을 입력해 주세요.');
        expect(validatePostForm({ ...post, title: 'a'.repeat(201) }).title).toBe('제목은 200자까지예요.');
    });

    it('사이트 주소는 http(s)만, 순서는 정수', () => {
        expect(validatePostForm({ ...post, siteUrl: 'linkbe.kr' }).siteUrl).toBe('https:// 로 시작하는 주소를 입력해 주세요.');
        expect(validatePostForm({ ...post, siteUrl: 'https://linkbe.kr' })).toEqual({});
        expect(validatePostForm({ ...post, sortOrder: '1.5' }).sortOrder).toBe('정수로 입력해 주세요.');
    });
});

describe('validatePopupForm', () => {
    const popup: PopupForm = { title: '이벤트', imageFileId: 3, linkUrl: '', startsAt: '2026-11-05T00:00', endsAt: '2026-11-30T23:59', posLeft: '10', posTop: '10', width: '400', isVisible: true };

    it('기간·크기', () => {
        expect(validatePopupForm(popup)).toEqual({});
        expect(validatePopupForm({ ...popup, endsAt: '2026-11-01T00:00' }).endsAt).toBe('끝 시각이 시작보다 늦어야 해요.');
        expect(validatePopupForm({ ...popup, startsAt: '' }).startsAt).toBe('시작 시각을 입력해 주세요.');
        expect(validatePopupForm({ ...popup, width: '50' }).width).toBe('100~1200 사이로 입력해 주세요.');
        expect(validatePopupForm({ ...popup, imageFileId: null }).imageFileId).toBe('이미지를 올려 주세요.');
    });
});
