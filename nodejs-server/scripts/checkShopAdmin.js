// 고객 회원 관리 API 점검: node scripts/checkShopAdmin.js  (모델·Slack 가짜)
const assert = require('assert');
const slack = require('../src/utils/slack');
const notices = [];
slack.sendSlackMessage = async (channel, text) => void notices.push({ channel, text });

const { requireHomepage } = require('../src/middlewares/requireHomepage');
const Member = require('../src/models/memberModel');

let listArgs;
Member.listForAdmin = async args => {
    listArgs = args;
    return { rows: [{ id: 1, login_id: 'a', name: '김', email: 'a@x.kr', phone: '010', status: 'active', created_at: 'c', last_login_at: null, order_count: '3', password_hash: 'x' }], total: 1 };
};
const members = { 5: { id: 5, name: '<b>홍</b>&', status: 'active' }, 6: { id: 6, name: '탈퇴 회원', status: 'left' } };
Member.findById = async id => members[id];
const left = [];
Member.leave = async id => (left.push(id), id === 5);

const ctrl = require('../src/controllers/adminShopController');
const call = async (fn, req) => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    await fn({ params: {}, query: {}, body: {}, ...req }, res);
    return res;
};

(async () => {
    const mw = req => new Promise(resolve => {
        const res = { status: c => ({ json: b => resolve([c, b]) }) };
        requireHomepage(req, res, () => resolve('next'));
    });
    assert.deepStrictEqual(await mw({ userRole: 'member', userHomepage: false }), [403, { error: 'Homepage only' }]);
    assert.strictEqual(await mw({ userRole: 'member', userHomepage: true }), 'next');

    let res = await call(ctrl.listMembers, { query: { q: '  김  ', page: '2', size: '999' } });
    assert.deepStrictEqual(listArgs, { q: '김', page: 2, size: 50 });
    assert.deepStrictEqual(Object.keys(res.body.members[0]), ['id', 'loginId', 'name', 'email', 'phone', 'status', 'createdAt', 'lastLoginAt', 'orderCount']);
    assert.strictEqual(res.body.members[0].orderCount, 3);
    assert.ok(!JSON.stringify(res.body).includes('password'));
    assert.deepStrictEqual([res.body.total, res.body.page, res.body.size], [1, 2, 50]);
    await call(ctrl.listMembers, { query: { page: '-1', size: 'x', q: 'a'.repeat(150) } });
    assert.deepStrictEqual([listArgs.page, listArgs.size, listArgs.q.length], [1, 20, 100]);

    for (const id of ['abc', '0', '99', '6']) {
        res = await call(ctrl.leaveMember, { params: { id } });
        assert.deepStrictEqual([res.code, res.body], [404, { error: 'Member not found' }], id);
    }
    assert.deepStrictEqual(left, [], '없거나 이미 탈퇴면 leave 호출 안 함');
    assert.strictEqual(notices.length, 0);

    res = await call(ctrl.leaveMember, { params: { id: '5' } });
    assert.deepStrictEqual(res.body, { ok: true });
    assert.strictEqual(notices.length, 1);
    assert.strictEqual(notices[0].text, '[회원탈퇴] 관리자 처리: &lt;b&gt;홍&lt;/b&gt;&amp;님');

    console.log('checkShopAdmin OK');
})().catch(error => {
    console.error(error);
    process.exit(1);
});
