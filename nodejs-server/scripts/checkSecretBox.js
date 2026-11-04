// 접속정보 암호화 점검: node scripts/checkSecretBox.js  (DB 없음)
const assert = require('assert');
const crypto = require('crypto');
const { encrypt, decrypt, isKeyReady } = require('../src/utils/secretBox');

const keyA = crypto.randomBytes(32).toString('base64');
const keyB = crypto.randomBytes(32).toString('base64');

// 키 없음·길이 틀림
delete process.env.CLIENT_SECRET_KEY;
assert.strictEqual(isKeyReady(), false);
assert.throws(() => encrypt('x'), e => e.message === 'Secret key missing' && e.code === 'SECRET_KEY_MISSING');
process.env.CLIENT_SECRET_KEY = Buffer.alloc(16).toString('base64');
assert.strictEqual(isKeyReady(), false);
assert.throws(() => encrypt('x'), /Secret key missing/);

process.env.CLIENT_SECRET_KEY = keyA;
assert.strictEqual(isKeyReady(), true);
assert.ok(encrypt('비밀').startsWith('v1:'));
assert.notStrictEqual(encrypt('같은값'), encrypt('같은값')); // 무작위 iv
for (const v of ['', '한글 비밀번호!@#', 'a'.repeat(5000)]) assert.strictEqual(decrypt(encrypt(v)), v);
assert.strictEqual(encrypt(null), null);
assert.strictEqual(decrypt(null), null);

// 한 글자 바꾸면 인증 실패
const good = encrypt('비밀번호');
const raw = Buffer.from(good.slice(3), 'base64');
raw[raw.length - 1] ^= 1;
assert.throws(() => decrypt('v1:' + raw.toString('base64')));
assert.throws(() => decrypt('v2:abc'));
assert.throws(() => decrypt('v1:'));

// 다른 키로 만든 값, 키 없을 때 복호
process.env.CLIENT_SECRET_KEY = keyB;
assert.throws(() => decrypt(good));
delete process.env.CLIENT_SECRET_KEY;
assert.throws(() => decrypt(good), /Secret key missing/);

console.log('checkSecretBox ✅');
