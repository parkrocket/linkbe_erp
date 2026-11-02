// 고객 회원 비밀번호 — 새 해시는 bcrypt, 예전 사이트(MySQL PASSWORD 형식 '*'+40자 hex)도 확인 후 재해시 유도
const bcrypt = require('bcrypt');
const crypto = require('crypto');

exports.hashPassword = plain => bcrypt.hash(plain, 10);

exports.verifyPassword = async (plain, stored) => {
    if (typeof plain !== 'string' || typeof stored !== 'string') return { ok: false, needsRehash: false };
    if (/^\*[0-9A-Fa-f]{40}$/.test(stored)) {
        const sha1 = d => crypto.createHash('sha1').update(d).digest();
        const calc = '*' + sha1(sha1(Buffer.from(plain, 'utf8'))).toString('hex').toUpperCase();
        const a = Buffer.from(calc);
        const b = Buffer.from(stored.toUpperCase());
        return { ok: crypto.timingSafeEqual(a, b), needsRehash: true };
    }
    if (stored.startsWith('$2')) {
        const ok = await bcrypt.compare(plain, stored).catch(() => false);
        return { ok, needsRehash: false };
    }
    return { ok: false, needsRehash: false };
};
