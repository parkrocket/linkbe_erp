// 거래처 접속정보 — API 응답 형태·라벨·입력 검사 (서버 clientValidation.js와 같은 규칙)
import { ApiError } from './api';

export type ClientKind = 'client' | 'own';
export type CredentialKind = 'site' | 'ftp' | 'admin' | 'hosting' | 'db' | 'mail' | 'etc';

export const CLIENT_KIND_LABEL: Record<ClientKind, string> = { client: '업체', own: '링크비' };
export const CREDENTIAL_KIND_LABEL: Record<CredentialKind, string> = {
    site: '호스팅 세트',
    ftp: 'FTP',
    admin: '사이트 관리자',
    hosting: '호스팅',
    db: 'DB',
    mail: '메일',
    etc: '기타',
};

export const maskedLabel = '••••••';
// 보기로 받은 평문을 화면에 두는 시간
export const REVEAL_MS = 30000;
export const MAX_FILE_MB = 50;
export const MAX_CLIENT_MEMO = 10000;

export type ClientRow = {
    id: number;
    kind: ClientKind;
    name: string;
    starred: boolean; // 별표(회사 공용) — 목록 위로
    credentialCount: number;
    fileCount: number;
    hasLegacyMemo: boolean;
    updatedAt: string;
};

export type Credential = {
    id: number;
    kind: CredentialKind;
    label: string;
    url: string;
    loginId: string;
    hasSecret: boolean;
    // 호스팅 세트(site)만 — 서버 주소는 url(ftp://·sftp://), 서버 계정은 loginId·secret
    port: number | null;
    adminUrl: string;
    adminId: string;
    hasAdminSecret: boolean;
    dbHost: string;
    dbName: string;
    dbId: string;
    hasDbSecret: boolean;
    hasMemo: boolean;
    memo: string | null; // 항목 메모는 화면에 바로 보이는 칸(비밀번호만 가림)
    memoUnreadable: boolean;
    sort: number;
    updatedAt: string;
};

// 보기·복사로 받는 비밀 칸 (서버 REVEAL_FIELDS)
export type SecretField = 'secret' | 'adminSecret' | 'dbSecret';

export type ClientFileRow = { id: number; originalName: string; size: number; createdAt: string };

export type AccessLog = {
    action: 'view' | 'copy' | 'create' | 'update' | 'delete' | 'download';
    target: 'client' | 'credential' | 'secret' | 'memo' | 'legacy' | 'file' | 'admin_pw' | 'db_pw';
    credentialLabel: string | null;
    actorName: string;
    createdAt: string;
};

export type ClientDetailData = {
    // memo: 업체 메모 — 항목 메모처럼 화면에 바로 보이는 칸(저장은 암호화)
    client: { id: number; kind: ClientKind; name: string; hasLegacyMemo: boolean; legacyMemoUnreadable: boolean; memo: string | null; memoUnreadable: boolean };
    credentials: Credential[];
    files: ClientFileRow[];
    logs: AccessLog[];
};

const ACTION_LABEL: Record<AccessLog['action'], string> = {
    view: '보기',
    copy: '복사',
    create: '추가',
    update: '수정',
    delete: '삭제',
    // 서버는 파일 확인 전에 기록하므로 실제 받았는지는 알 수 없음
    download: '내려받기 시도',
};
const TARGET_LABEL: Record<AccessLog['target'], string> = {
    client: '업체',
    credential: '항목',
    secret: '비밀번호',
    memo: '메모',
    legacy: '예전 메모',
    file: '첨부',
    admin_pw: '관리자 비밀번호',
    db_pw: 'DB 비밀번호',
};

// 기록 한 줄: "홍길동 · 비밀번호 보기 · 항목 이름"
export const logText = (l: AccessLog) =>
    `${l.actorName || '알 수 없음'} · ${TARGET_LABEL[l.target]} ${ACTION_LABEL[l.action]}${l.credentialLabel ? ` · ${l.credentialLabel}` : ''}`;

// 링크는 http(s)만 — ftp·sftp 등은 글자로만 보여줌
export const isWebUrl = (url: string) => /^https?:\/\//i.test(url);

export type Protocol = 'ftp' | 'sftp';
export const DEFAULT_PORT: Record<Protocol, string> = { ftp: '21', sftp: '22' };

// 세트 서버 주소 'sftp://host' → 방식·호스트
export const splitServer = (url: string): { protocol: Protocol; host: string } => {
    const m = /^(s?ftp):\/\/(.*)$/i.exec(url);
    return m ? { protocol: m[1].toLowerCase() as Protocol, host: m[2] } : { protocol: 'ftp', host: url };
};

// secret·adminSecret·dbSecret: 비워 두면 그대로(고칠 때), clear* = 지우기
export type CredentialForm = {
    kind: CredentialKind;
    label: string;
    url: string;
    loginId: string;
    secret: string;
    memo: string;
    clearSecret: boolean;
    protocol: Protocol;
    host: string;
    port: string;
    adminUrl: string;
    adminId: string;
    adminSecret: string;
    clearAdminSecret: boolean;
    dbHost: string;
    dbName: string;
    dbId: string;
    dbSecret: string;
    clearDbSecret: boolean;
};

export const emptyCredentialForm = (): CredentialForm => ({
    kind: 'site',
    label: '',
    url: '',
    loginId: '',
    secret: '',
    memo: '',
    clearSecret: false,
    protocol: 'ftp',
    host: '',
    port: DEFAULT_PORT.ftp,
    adminUrl: '',
    adminId: '',
    adminSecret: '',
    clearAdminSecret: false,
    dbHost: '',
    dbName: '',
    dbId: '',
    dbSecret: '',
    clearDbSecret: false,
});

// 고치기 — 비밀번호는 불러오지 않음(비워 두면 그대로), 메모는 보이는 칸이라 채워 둠
export const credentialToForm = (c: Credential): CredentialForm => {
    const server = c.kind === 'site' ? splitServer(c.url) : null;
    return {
        ...emptyCredentialForm(),
        kind: c.kind,
        label: c.label,
        url: c.url,
        loginId: c.loginId,
        memo: c.memo ?? '',
        protocol: server?.protocol ?? 'ftp',
        host: server?.host ?? '',
        port: c.port === null ? '' : String(c.port),
        adminUrl: c.adminUrl,
        adminId: c.adminId,
        dbHost: c.dbHost,
        dbName: c.dbName,
        dbId: c.dbId,
    };
};

const URL_RE = /^(https?|ftps?|sftp):\/\//i;
// 주소 안의 아이디·비밀번호(user:pass@host) — 평문이 가려지지 않고 목록·기록에 그대로 보이므로 거절
const URL_USERINFO_RE = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i;

type ErrorKey = 'label' | 'url' | 'loginId' | 'secret' | 'memo' | 'host' | 'port' | 'adminUrl' | 'adminId' | 'adminSecret' | 'dbHost' | 'dbName' | 'dbId' | 'dbSecret';
export type CredentialErrors = Partial<Record<ErrorKey, string>>;

// allowPlain: 세트가 아닌 항목의 주소 칸 — 앞머리 없는 주소(아이피·도메인·localhost:3306 등)도 받음(서버 isAddress와 같은 규칙, 화면에는 글자로만 보임)
const urlError = (url: string, allowPlain = false): string | undefined => {
    if (url.length > 500) return '주소는 500자까지예요';
    if (allowPlain && url && !url.includes('://')) {
        if (/^(javascript|data|vbscript):/i.test(url)) return '쓸 수 없는 주소예요';
        if (url.includes('@')) return '주소에 아이디·비밀번호를 넣지 말고 아이디·비밀번호 칸에 넣어 주세요';
        return;
    }
    if (url && !URL_RE.test(url)) return 'http://, https://, ftp://, sftp:// 로 시작해야 해요';
    if (URL_USERINFO_RE.test(url)) return '주소에 아이디·비밀번호를 넣지 말고 아이디·비밀번호 칸에 넣어 주세요';
};

export function validateCredentialForm(f: CredentialForm): CredentialErrors {
    const e: CredentialErrors = {};
    const tooLong = (key: ErrorKey, value: string, max: number, name: string) => {
        if (value.length > max) e[key] = `${name} ${max.toLocaleString()}자까지예요`;
    };
    tooLong('label', f.label.trim(), 100, '이름은');
    tooLong('loginId', f.loginId.trim(), 200, '아이디는');
    tooLong('secret', f.secret, 500, '비밀번호는');
    tooLong('memo', f.memo, 5000, '메모는');
    if (f.kind !== 'site') {
        const err = urlError(f.url.trim(), true);
        if (err) e.url = err;
        return e;
    }
    const host = f.host.trim();
    if (/:\/\/|@/.test(host)) e.host = 'ftp:// 없이 서버 주소만, 아이디는 아이디 칸에 넣어 주세요';
    else tooLong('host', host, 480, '서버 주소는');
    const port = f.port.trim();
    if (port && !(/^\d{1,5}$/.test(port) && Number(port) >= 1 && Number(port) <= 65535)) e.port = '포트는 1~65535 숫자예요';
    const adminErr = urlError(f.adminUrl.trim());
    if (adminErr) e.adminUrl = adminErr;
    tooLong('adminId', f.adminId.trim(), 200, '아이디는');
    tooLong('adminSecret', f.adminSecret, 500, '비밀번호는');
    tooLong('dbHost', f.dbHost.trim(), 200, 'DB 호스트는');
    tooLong('dbName', f.dbName.trim(), 100, 'DB 이름은');
    tooLong('dbId', f.dbId.trim(), 200, '아이디는');
    tooLong('dbSecret', f.dbSecret, 500, '비밀번호는');
    return e;
}

// 비밀번호 칸: 비워 두면 키를 빼서(서버: 그대로), 지우기면 ''(서버: 지움)
const secretBody = (value: string, clear: boolean) => (clear ? '' : value === '' ? undefined : value);

// 요청 본문 — 메모는 보이는 칸이라 고칠 때 현재 값을 채워 두고 항상 보냄('' = 지움)
export function credentialBody(f: CredentialForm) {
    const base = {
        kind: f.kind,
        label: f.label.trim(),
        loginId: f.loginId.trim(),
        secret: secretBody(f.secret, f.clearSecret),
        memo: f.memo,
    };
    if (f.kind !== 'site') return { ...base, url: f.url.trim() };
    const host = f.host.trim();
    return {
        ...base,
        url: host ? `${f.protocol}://${host}` : '',
        port: f.port.trim() ? Number(f.port.trim()) : null,
        adminUrl: f.adminUrl.trim(),
        adminId: f.adminId.trim(),
        adminSecret: secretBody(f.adminSecret, f.clearAdminSecret),
        dbHost: f.dbHost.trim(),
        dbName: f.dbName.trim(),
        dbId: f.dbId.trim(),
        dbSecret: secretBody(f.dbSecret, f.clearDbSecret),
    };
}

// 메모가 이보다 길거나 줄이 많으면 접어서 보여 줌
export const MEMO_FOLD_CHARS = 200;
export const MEMO_FOLD_LINES = 4;
export const isLongMemo = (memo: string) => memo.length > MEMO_FOLD_CHARS || memo.split('\n').length > MEMO_FOLD_LINES;

export function validateClientName(name: string): string | undefined {
    const n = name.trim();
    if (!n) return '업체 이름을 입력해 주세요';
    if (n.length > 100) return '업체 이름은 100자까지예요';
}

export function clientErrorText(e: unknown): string {
    if (e instanceof ApiError) {
        if (e.status === 503) return '암호화 키가 설정되지 않았어요. 관리자에게 알려 주세요.';
        if (e.status === 403) return '거래처 접속정보 권한이 없어요.';
        if (e.status === 404) return '이미 지워졌거나 찾을 수 없어요. 새로고침해 주세요.';
        if (e.status === 413) return `파일은 ${MAX_FILE_MB}MB까지 올릴 수 있어요.`;
        if (e.status === 409 && e.reason === 'Too many files') return '첨부는 업체당 20개까지예요.';
        if (e.status === 400) return e.reason === 'Invalid file' ? '올릴 수 없는 파일이에요. (pdf·이미지·문서·zip만 가능)' : '입력을 확인해 주세요.';
    }
    return '처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export const formatSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
