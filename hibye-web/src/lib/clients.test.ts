import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { clientErrorText, credentialBody, emptyCredentialForm, isLongMemo, isWebUrl, logText, validateClientName, validateCredentialForm, REVEAL_MS } from './clients';

describe('clients', () => {
    it('항목 입력 검사', () => {
        const f = emptyCredentialForm();
        expect(validateCredentialForm(f)).toEqual({});
        expect(validateCredentialForm({ ...f, url: 'javascript:alert(1)' }).url).toBeTruthy();
        expect(validateCredentialForm({ ...f, url: 'sftp://a.example' }).url).toBeUndefined();
        expect(validateCredentialForm({ ...f, url: 'ftp://user:pw@a.example' }).url).toBe('주소에 아이디·비밀번호를 넣지 말고 아이디·비밀번호 칸에 넣어 주세요');
        expect(validateCredentialForm({ ...f, url: 'https://user@a.example/x' }).url).toBeTruthy();
        expect(validateCredentialForm({ ...f, url: 'https://a.example/x?mail=a@b.kr' }).url).toBeUndefined();
        expect(validateCredentialForm({ ...f, secret: 'x'.repeat(501) }).secret).toBeTruthy();
        expect(validateCredentialForm({ ...f, memo: 'x'.repeat(5001) }).memo).toBeTruthy();
        expect(validateClientName('  ')).toBeTruthy();
        expect(validateClientName('테스트업체')).toBeUndefined();
    });

    it('비밀번호: 비우면 키 제외·지우기면 빈 문자열, 메모: 항상 그대로 보냄', () => {
        const f = { ...emptyCredentialForm(), label: ' 가 ' };
        const keep = credentialBody(f);
        expect(JSON.parse(JSON.stringify(keep))).not.toHaveProperty('secret');
        expect(keep.memo).toBe('');
        expect(credentialBody({ ...f, secret: 'pw', memo: '메모' })).toMatchObject({ label: '가', secret: 'pw', memo: '메모' });
        expect(credentialBody({ ...f, secret: 'pw', clearSecret: true }).secret).toBe('');
    });

    it('긴 메모 접기 기준', () => {
        expect(isLongMemo('짧은 메모')).toBe(false);
        expect(isLongMemo('x'.repeat(201))).toBe(true);
        expect(isLongMemo('1\n2\n3\n4')).toBe(false);
        expect(isLongMemo('1\n2\n3\n4\n5')).toBe(true);
    });

    it('링크·기록·오류 문구', () => {
        expect(isWebUrl('https://a.example')).toBe(true);
        expect(isWebUrl('ftp://a.example')).toBe(false);
        expect(logText({ action: 'download', target: 'file', credentialLabel: null, actorName: '홍길동', createdAt: '' })).toBe('홍길동 · 첨부 내려받기 시도');
        expect(clientErrorText(new ApiError(503, 'Secret key missing'))).toBe('암호화 키가 설정되지 않았어요. 관리자에게 알려 주세요.');
        expect(REVEAL_MS).toBe(30000);
    });
});
