// 민감 필드 제거 점검: node scripts/checkSafeUser.js
const assert = require('assert');
const { toSafeUser } = require('../src/utils/safeUser');

const row = { user_id: 'a@b.c', user_name: '홍', user_password: '$2b$hash', start_time: null };
assert.deepStrictEqual(toSafeUser(row), { user_id: 'a@b.c', user_name: '홍', start_time: null });
assert.ok(!('user_password' in toSafeUser({ user_password: 'x' })));

console.log('checkSafeUser ✅');
