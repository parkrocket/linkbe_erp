// 거래처 접속정보 암호화 (AES-256-GCM) — 저장값 = 'v1:' + base64(iv 12 + tag 16 + 암호문)
// 키: 환경변수 CLIENT_SECRET_KEY(base64, 32바이트). 호출할 때마다 읽음(서버 시작은 막지 않음). 평문·키·암호문은 로그에 쓰지 않음
const crypto = require('crypto');

const PREFIX = 'v1:';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

// 키를 읽어 표준 base64 32바이트(43자 + '=')가 아니면 null — Buffer.from은 틀린 글자를 조용히 버리므로 형식을 먼저 검사
function readKey() {
    const text = (process.env.CLIENT_SECRET_KEY || '').trim();
    if (!/^[A-Za-z0-9+/]{43}=$/.test(text)) return null;
    const key = Buffer.from(text, 'base64');
    return key.length === 32 ? key : null;
}

function requireKey() {
    const key = readKey();
    if (!key) {
        const error = new Error('Secret key missing');
        error.code = 'SECRET_KEY_MISSING';
        throw error;
    }
    return key;
}

const isKeyReady = () => readKey() !== null;

// null → null, 문자열 → 암호화 (같은 값도 매번 다른 결과)
function encrypt(plain) {
    if (plain === null || plain === undefined) return null;
    const key = requireKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
    const body = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

// null → null, 키 없음·변조·다른 키·형식 오류는 throw (호출 쪽에서 칸별 unreadable 처리)
function decrypt(stored) {
    if (stored === null || stored === undefined) return null;
    const key = requireKey();
    if (typeof stored !== 'string' || !stored.startsWith(PREFIX)) throw new Error('Invalid secret format');
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    if (raw.length < IV_LENGTH + TAG_LENGTH) throw new Error('Invalid secret format');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_LENGTH), { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH));
    return Buffer.concat([decipher.update(raw.subarray(IV_LENGTH + TAG_LENGTH)), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt, isKeyReady };
