import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { clientErrorText, credentialBody, credentialToForm, emptyCredentialForm, splitServer, type Credential, isLongMemo, isWebUrl, logText, validateClientName, validateCredentialForm, REVEAL_MS } from './clients';

describe('clients', () => {
    it('항목 입력 검사', () => {
        const f = { ...emptyCredentialForm(), kind: 'ftp' as const };
        expect(validateCredentialForm(f)).toEqual({});
        expect(validateCredentialForm(emptyCredentialForm())).toEqual({});
        expect(validateCredentialForm({ ...f, url: 'javascript:alert(1)' }).url).toBeTruthy();
        expect(validateCredentialForm({ ...f, url: 'sftp://a.example' }).url).toBeUndefined();
        // 앞머리 없는 주소(아이피·도메인·포트)도 받음 — 모르는 앞머리·아이디 섞임은 거절
        for (const url of ['192.168.0.10', 'example.com', 'localhost:3306']) expect(validateCredentialForm({ ...f, url }).url).toBeUndefined();
        for (const url of ['file://a', 'user@1.2.3.4', 'data:text/html,x']) expect(validateCredentialForm({ ...f, url }).url).toBeTruthy();
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

    it('호스팅 세트: 입력 검사·본문·고치기 불러오기', () => {
        const f = { ...emptyCredentialForm(), host: ' a.cafe24.com ', loginId: 'f', secret: 'pw', adminUrl: 'https://a.kr/adm', adminId: 'adm', dbHost: 'localhost', dbName: 'n', dbId: 'd', dbSecret: 'dp' };
        expect(validateCredentialForm(f)).toEqual({});
        expect(validateCredentialForm({ ...f, host: 'ftp://a' }).host).toBeTruthy();
        expect(validateCredentialForm({ ...f, host: 'u@a' }).host).toBeTruthy();
        for (const port of ['0', '65536', 'a', '1.5']) expect(validateCredentialForm({ ...f, port }).port, port).toBeTruthy();
        expect(validateCredentialForm({ ...f, port: '' }).port).toBeUndefined();
        expect(validateCredentialForm({ ...f, adminUrl: 'javascript:x' }).adminUrl).toBeTruthy();
        const body = credentialBody({ ...f, protocol: 'sftp', port: '2222' });
        expect(body).toMatchObject({ kind: 'site', url: 'sftp://a.cafe24.com', port: 2222, adminId: 'adm', dbSecret: 'dp' });
        expect(JSON.parse(JSON.stringify(body))).not.toHaveProperty('adminSecret');
        expect(credentialBody({ ...f, host: '', port: '' })).toMatchObject({ url: '', port: null });
        expect(credentialBody({ ...f, clearAdminSecret: true })).toMatchObject({ adminSecret: '' });
        // 세트가 아닌 항목은 세트 칸을 보내지 않음
        expect(credentialBody({ ...f, kind: 'ftp', url: 'ftp://x' })).not.toHaveProperty('adminId');
        expect(splitServer('SFTP://h.kr')).toEqual({ protocol: 'sftp', host: 'h.kr' });
        const c = { id: 1, kind: 'site', label: '메인', url: 'sftp://h.kr', loginId: 'f', hasSecret: true, port: 22, adminUrl: 'https://a', adminId: 'adm', hasAdminSecret: true, dbHost: 'localhost', dbName: 'n', dbId: 'd', hasDbSecret: false, hasMemo: false, memo: null, memoUnreadable: false, sort: 0, updatedAt: '' } satisfies Credential;
        expect(credentialToForm(c)).toMatchObject({ protocol: 'sftp', host: 'h.kr', port: '22', adminId: 'adm', secret: '', adminSecret: '', dbSecret: '' });
        expect(logText({ action: 'view', target: 'db_pw', credentialLabel: '메인', actorName: '홍길동', createdAt: '' })).toBe('홍길동 · DB 비밀번호 보기 · 메인');
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
