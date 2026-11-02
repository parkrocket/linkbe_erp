// 고객 회원 모델 SQL 점검: node scripts/checkMemberModel.js  (pool 가짜 — SQL·파라미터만 확인, DB 접속 없음)
const assert = require('assert');
const pool = require('../src/config/dbPromise');

let calls = [];
let reply = [[]];
pool.query = async (sql, params) => (calls.push({ sql, params }), reply);
const Member = require('../src/models/memberModel');
const last = () => calls[calls.length - 1];
const all = () => calls.map(c => c.sql).join('\n');

(async () => {
    // 생성: 동의 시각, 바인딩, 중복 오류는 그대로
    reply = [{ insertId: 7 }];
    assert.strictEqual(await Member.create({ loginId: 'a', passwordHash: 'h', name: 'n', email: 'e', phone: 'p' }), 7);
    assert.ok(/agreed_at/.test(last().sql) && /NOW\(\)/.test(last().sql));
    assert.deepStrictEqual(last().params, ['a', 'h', 'n', 'e', 'p']);
    const dup = Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
    pool.query = async () => { throw dup; };
    await assert.rejects(Member.create({}), e => e.code === 'ER_DUP_ENTRY');
    pool.query = async (sql, params) => (calls.push({ sql, params }), reply);

    // 로그인 조회: active만
    reply = [[{ id: 1 }]];
    assert.deepStrictEqual(await Member.findByLoginId('a'), { id: 1 });
    assert.ok(/status = 'active'/.test(last().sql) && /password_hash/.test(last().sql));
    assert.deepStrictEqual(last().params, ['a']);

    // 조회: 해시 제외
    await Member.findById(3);
    assert.ok(!/password_hash/.test(last().sql), 'findById는 해시 제외');
    assert.deepStrictEqual(last().params, [3]);

    // 해시 조회: active만, 없으면 null
    reply = [[]];
    assert.strictEqual(await Member.findPasswordHash(3), null);
    assert.ok(/status = 'active'/.test(last().sql));
    reply = [[{ password_hash: 'x' }]];
    assert.strictEqual(await Member.findPasswordHash(3), 'x');

    // 로그인 기록: password_changed_at은 건드리지 않음
    reply = [{ affectedRows: 1 }];
    await Member.markLogin(3, null);
    assert.ok(/last_login_at = NOW\(\)/.test(last().sql) && !/password_hash/.test(last().sql));
    await Member.markLogin(3, 'newhash');
    assert.ok(/password_hash = \?/.test(last().sql) && !/password_changed_at/.test(last().sql));
    assert.deepStrictEqual(last().params, ['newhash', 3]);

    // 비밀번호 변경: password_changed_at 갱신 + 토큰 비움
    await Member.updatePassword(3, 'h2');
    assert.ok(/password_changed_at = NOW\(\)/.test(last().sql) && /reset_token_hash = NULL/.test(last().sql));
    assert.deepStrictEqual(last().params, ['h2', 3]);

    // 정보 수정
    await Member.updateProfile(3, { name: 'n', email: 'e', phone: 'p' });
    assert.ok(/UPDATE hp_member SET name = \?, email = \?, phone = \? WHERE id = \?/.test(last().sql));

    // 재설정 토큰: UPDATE 1건일 때만 대상 반환
    calls = [];
    pool.query = async (sql, params) => (calls.push({ sql, params }), /^UPDATE/.test(sql) ? [{ affectedRows: 1 }] : [[{ id: 5, name: '홍' }]]);
    const exp = new Date('2026-11-05T00:00:00Z');
    assert.deepStrictEqual(await Member.setResetToken('a@b.c', 'th', exp), { id: 5, name: '홍' });
    assert.ok(/WHERE email = \? AND status = 'active'/.test(calls[0].sql));
    assert.deepStrictEqual(calls[0].params, ['th', exp, 'a@b.c']);
    pool.query = async (sql, params) => (calls.push({ sql, params }), [{ affectedRows: 0 }]);
    calls = [];
    assert.strictEqual(await Member.setResetToken('x@b.c', 'th', exp), undefined);
    assert.strictEqual(calls.length, 1, '대상 없으면 SELECT 안 함');

    // 토큰으로 재설정: 만료·active 조건부, affectedRows 1
    pool.query = async (sql, params) => (calls.push({ sql, params }), [{ affectedRows: 1 }]);
    assert.strictEqual(await Member.resetPasswordByToken('th', 'h3'), true);
    assert.ok(/reset_expires_at > NOW\(\)/.test(last().sql) && /status = 'active'/.test(last().sql) && /password_changed_at = NOW\(\)/.test(last().sql));
    assert.deepStrictEqual(last().params, ['h3', 'th']);
    pool.query = async (sql, params) => (calls.push({ sql, params }), [{ affectedRows: 0 }]);
    assert.strictEqual(await Member.resetPasswordByToken('th', 'h3'), false);

    // 탈퇴: 개인정보 비움, active만
    pool.query = async (sql, params) => (calls.push({ sql, params }), [{ affectedRows: 1 }]);
    assert.strictEqual(await Member.leave(3), true);
    const l = last().sql;
    assert.ok(/status = 'left'/.test(l) && /email = NULL/.test(l) && /login_id = NULL/.test(l) && /password_hash = NULL/.test(l) && /phone = NULL/.test(l));
    assert.ok(/reset_token_hash = NULL/.test(l) && /reset_expires_at = NULL/.test(l) && /left_at = NOW\(\)/.test(l));
    assert.ok(/WHERE id = \? AND status = 'active'/.test(l));
    assert.deepStrictEqual(last().params, [3]);

    // 관리 목록: LIKE 이스케이프(\ % _), 페이지 바인딩
    calls = [];
    pool.query = async (sql, params) => (calls.push({ sql, params }), /COUNT\(\*\) AS n/.test(sql) ? [[{ n: 41 }]] : [[{ id: 1 }]]);
    const res = await Member.listForAdmin({ q: 'a%b', page: 2, size: 20 });
    assert.deepStrictEqual(res, { rows: [{ id: 1 }], total: 41 });
    const ls = calls.find(c => !/COUNT\(\*\) AS n/.test(c.sql));
    assert.ok(/login_id LIKE \? OR m\.name LIKE \? OR m\.email LIKE \?/.test(ls.sql) && /order_count/.test(ls.sql) && /ORDER BY m\.id DESC LIMIT \? OFFSET \?/.test(ls.sql));
    assert.deepStrictEqual(ls.params, ['%a\\%b%', '%a\\%b%', '%a\\%b%', 20, 20]);
    assert.ok(!/password_hash/.test(ls.sql));
    calls = [];
    await Member.listForAdmin({ q: 'a_b\\c', page: 1, size: 20 });
    assert.strictEqual(calls[0].params[0], '%a\\_b\\\\c%');
    calls = [];
    await Member.listForAdmin({ page: 1, size: 10 });
    assert.ok(!/LIKE/.test(calls[0].sql));
    assert.deepStrictEqual(calls[0].params, [10, 0]);

    assert.ok(!/SELECT\s+\*/i.test(all()), 'SELECT * 금지');
    console.log('checkMemberModel OK');
    process.exit(0);
})().catch(err => {
    console.error('checkMemberModel 실패', err.message);
    process.exit(1);
});
