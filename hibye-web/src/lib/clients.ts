// 거래처 접속정보 — API 응답 형태·라벨·입력 검사 (서버 clientValidation.js와 같은 규칙)
import { ApiError } from './api';

export type ClientKind = 'client' | 'own';
export type CredentialKind = 'ftp' | 'admin' | 'hosting' | 'db' | 'mail' | 'etc';

export const CLIENT_KIND_LABEL: Record<ClientKind, string> = { client: '업체', own: '링크비' };
export const CREDENTIAL_KIND_LABEL: Record<CredentialKind, string> = {
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

export type ClientRow = {
    id: number;
    kind: ClientKind;
    name: string;
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
    hasMemo: boolean;
    memo: string | null; // 항목 메모는 화면에 바로 보이는 칸(비밀번호만 가림)
    memoUnreadable: boolean;
    sort: number;
    updatedAt: string;
};

export type ClientFileRow = { id: number; originalName: string; size: number; createdAt: string };

export type AccessLog = {
    action: 'view' | 'copy' | 'create' | 'update' | 'delete' | 'download';
    target: 'client' | 'credential' | 'secret' | 'memo' | 'legacy' | 'file';
    credentialLabel: string | null;
    actorName: string;
    createdAt: string;
};

export type ClientDetailData = {
    client: { id: number; kind: ClientKind; name: string; hasLegacyMemo: boolean; legacyMemoUnreadable: boolean };
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
};

// 기록 한 줄: "홍길동 · 비밀번호 보기 · 항목 이름"
export const logText = (l: AccessLog) =>
    `${l.actorName || '알 수 없음'} · ${TARGET_LABEL[l.target]} ${ACTION_LABEL[l.action]}${l.credentialLabel ? ` · ${l.credentialLabel}` : ''}`;

// 링크는 http(s)만 — ftp·sftp 등은 글자로만 보여줌
export const isWebUrl = (url: string) => /^https?:\/\//i.test(url);

export type CredentialForm = {
    kind: CredentialKind;
    label: string;
    url: string;
    loginId: string;
    secret: string;
    memo: string;
    clearSecret: boolean;
};

export const emptyCredentialForm = (): CredentialForm => ({
    kind: 'ftp',
    label: '',
    url: '',
    loginId: '',
    secret: '',
    memo: '',
    clearSecret: false,
});

const URL_RE = /^(https?|ftps?|sftp):\/\//i;
// 주소 안의 아이디·비밀번호(user:pass@host) — 평문이 가려지지 않고 목록·기록에 그대로 보이므로 거절
const URL_USERINFO_RE = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i;

export type CredentialErrors = Partial<Record<'label' | 'url' | 'loginId' | 'secret' | 'memo', string>>;

export function validateCredentialForm(f: CredentialForm): CredentialErrors {
    const e: CredentialErrors = {};
    if (f.label.trim().length > 100) e.label = '이름은 100자까지예요';
    const url = f.url.trim();
    if (url.length > 500) e.url = '주소는 500자까지예요';
    else if (url && !URL_RE.test(url)) e.url = 'http://, https://, ftp://, sftp:// 로 시작해야 해요';
    else if (URL_USERINFO_RE.test(url)) e.url = '주소에 아이디·비밀번호를 넣지 말고 아이디·비밀번호 칸에 넣어 주세요';
    if (f.loginId.trim().length > 200) e.loginId = '아이디는 200자까지예요';
    if (f.secret.length > 500) e.secret = '비밀번호는 500자까지예요';
    if (f.memo.length > 5000) e.memo = '메모는 5,000자까지예요';
    return e;
}

// 요청 본문 — 비밀번호는 비워 두면 키를 빼서(서버: 그대로), '지우기'면 ''(서버: 지움).
// 메모는 보이는 칸이라 고칠 때 현재 값을 채워 두고 항상 보냄('' = 지움)
export function credentialBody(f: CredentialForm) {
    return {
        kind: f.kind,
        label: f.label.trim(),
        url: f.url.trim(),
        loginId: f.loginId.trim(),
        secret: f.clearSecret ? '' : f.secret === '' ? undefined : f.secret,
        memo: f.memo,
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
