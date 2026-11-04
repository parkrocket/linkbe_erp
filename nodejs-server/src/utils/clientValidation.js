// 거래처 접속정보 입력 검사 — 정해진 값은 3-4 constraints 기준, 칸 길이는 migrations/2026-11-07-work-clients.sql 기준
const { str } = require('./contractValidation');

const CLIENT_KINDS = ['client', 'own']; // 업체, 링크비
const CREDENTIAL_KINDS = ['ftp', 'admin', 'hosting', 'db', 'mail', 'etc'];
const REVEAL_FIELDS = ['secret', 'memo'];
const REVEAL_ACTIONS = ['view', 'copy'];

const fail = error => ({ ok: false, error });

const validateClient = input => {
    const b = input || {};
    if (!CLIENT_KINDS.includes(b.kind)) return fail('Invalid kind');
    const name = str(b.name, 100);
    if (!name) return fail('Invalid name');
    return { ok: true, value: { kind: b.kind, name } };
};

// 비밀 칸(비밀번호·메모): undefined = 그대로(수정 시), null·'' = 지움(null), 문자열 = 저장. 공백도 값이라 trim하지 않음
// 반환: undefined | null | 문자열, 형식이 틀리면 false
const secretField = (v, max) => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    return typeof v === 'string' && v.length <= max ? v : false;
};

// url: 빈 값 또는 http(s)·ftp(s)·sftp만 — javascript: 등은 화면 링크로 쓰일 수 있어 거절
const URL_RE = /^(https?|ftps?|sftp):\/\//i;
// 주소 안의 아이디·비밀번호(user:pass@host)는 거절 — 평문이 암호화되지 않고 목록·기록에 그대로 남음 (화면 lib/clients.ts와 같은 규칙)
const URL_USERINFO_RE = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i;

const validateCredential = input => {
    const b = input || {};
    if (!CREDENTIAL_KINDS.includes(b.kind)) return fail('Invalid kind');
    const label = str(b.label, 100);
    if (label === null) return fail('Invalid label');
    const url = str(b.url, 500);
    if (url === null || (url !== '' && (!URL_RE.test(url) || URL_USERINFO_RE.test(url)))) return fail('Invalid url');
    const loginId = str(b.loginId, 200);
    if (loginId === null) return fail('Invalid loginId');
    const secret = secretField(b.secret, 500);
    if (secret === false) return fail('Invalid secret');
    const memo = secretField(b.memo, 5000);
    if (memo === false) return fail('Invalid memo');
    return { ok: true, value: { kind: b.kind, label, url, loginId, secret, memo } };
};

// 보기·복사 요청 — withField: 항목(비밀번호·메모 중 하나), 아니면 예전 메모(field 없음)
const validateReveal = (input, withField) => {
    const b = input || {};
    if (withField && !REVEAL_FIELDS.includes(b.field)) return fail('Invalid field');
    if (!REVEAL_ACTIONS.includes(b.action)) return fail('Invalid action');
    return { ok: true, value: { field: withField ? b.field : null, action: b.action } };
};

module.exports = { validateClient, validateCredential, validateReveal, CLIENT_KINDS, CREDENTIAL_KINDS };
