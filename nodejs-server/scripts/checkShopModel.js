// 개인결제 상품·주문 모델 SQL 점검: node scripts/checkShopModel.js  (pool 가짜 — SQL·파라미터만 확인, DB 접속 없음)
const assert = require('assert');
const pool = require('../src/config/dbPromise');

let calls = [];
const seen = []; // 모든 쿼리 누적(calls는 중간에 비움)
let reply = [[]];
pool.query = async (sql, params) => (calls.push({ sql, params }), seen.push(sql), reply);
const Product = require('../src/models/productModel');
const Order = require('../src/models/orderModel');
const last = () => calls[calls.length - 1];
const all = () => calls.map(c => c.sql).join('\n');

(async () => {
    // 상품 공개 조회: 판매 중만, 본문 제외 목록
    reply = [[{ id: 1 }]];
    assert.deepStrictEqual(await Product.listVisible(), [{ id: 1 }]);
    assert.ok(/is_visible = 1/.test(last().sql) && /ORDER BY sort_order DESC, id DESC/.test(last().sql) && !/body_html/.test(last().sql));
    assert.deepStrictEqual(await Product.findVisible(5), { id: 1 });
    assert.ok(/id = \? AND is_visible = 1/.test(last().sql) && /body_html/.test(last().sql) && /updated_at/.test(last().sql));
    assert.deepStrictEqual(last().params, [5]);
    await Product.findById(5);
    assert.ok(!/is_visible = 1/.test(last().sql));

    // 상품 관리 목록: 본문 제외, order_count, total
    calls = [];
    pool.query = async (sql, params) => (calls.push({ sql, params }), seen.push(sql), /COUNT\(\*\) AS n FROM hp_product/.test(sql) ? [[{ n: 3 }]] : [[{ id: 1 }]]);
    assert.deepStrictEqual(await Product.listForAdmin({ page: 2, size: 10 }), { rows: [{ id: 1 }], total: 3 });
    assert.ok(/order_count/.test(calls[0].sql) && !/body_html/.test(calls[0].sql));
    assert.deepStrictEqual(calls[0].params, [10, 10]);
    pool.query = async (sql, params) => (calls.push({ sql, params }), seen.push(sql), reply);

    // 상품 저장: 등록은 INSERT(body_html 항상 값), 수정은 expected 있을 때 updated_at 조건, 0행이면 conflict
    const data = { title: 't', price: 1000, bodyHtml: '', imageFileId: null, isVisible: 1, sortOrder: 0 };
    reply = [{ insertId: 9 }];
    assert.strictEqual(await Product.save(null, data, 4), 9);
    assert.ok(/INSERT INTO hp_product/.test(last().sql) && /body_html/.test(last().sql));
    assert.deepStrictEqual(last().params, ['t', 1000, '', null, 1, 0, 4]);
    reply = [{ affectedRows: 1 }];
    assert.strictEqual(await Product.save(3, data, 4), 3);
    assert.ok(/WHERE id = \?$/.test(last().sql) && !/updated_at = \?/.test(last().sql));
    const stamp = new Date('2026-11-03T00:00:00Z');
    assert.strictEqual(await Product.save(3, data, 4, stamp), 3);
    assert.ok(/WHERE id = \? AND updated_at = \?$/.test(last().sql));
    assert.strictEqual(last().params[last().params.length - 1], stamp, '받은 값 그대로 바인딩');
    reply = [{ affectedRows: 0 }];
    assert.strictEqual(await Product.save(3, data, 4, stamp), 'conflict');

    // 상품 삭제: 한 문장 조건부 DELETE, 0행이면 주문 여부로 구분
    reply = [{ affectedRows: 1 }];
    assert.strictEqual(await Product.remove(3), true);
    assert.ok(/DELETE FROM hp_product WHERE id = \? AND NOT EXISTS \(SELECT 1 FROM hp_order WHERE product_id = \?\)/.test(last().sql));
    assert.deepStrictEqual(last().params, [3, 3]);
    pool.query = async (sql, params) => (calls.push({ sql, params }), seen.push(sql), /^DELETE/.test(sql) ? [{ affectedRows: 0 }] : [[{ n: 2 }]]);
    assert.strictEqual(await Product.remove(3), 'has_orders');
    pool.query = async (sql, params) => (calls.push({ sql, params }), seen.push(sql), /^DELETE/.test(sql) ? [{ affectedRows: 0 }] : [[{ n: 0 }]]);
    assert.strictEqual(await Product.remove(3), false);
    pool.query = async (sql, params) => (calls.push({ sql, params }), seen.push(sql), reply);

    // 주문 생성: history 포함 13칸 바인딩
    const o = { order_no: 'N1', member_id: 1, product_id: 2, product_title: 'p', amount: 100, pay_method: 'card', status: 'pending', buyer_name: 'b', buyer_email: 'e', buyer_phone: 'p', buyer_memo: null, deposit_name: null, history: 'h' };
    reply = [{ insertId: 11 }];
    assert.strictEqual(await Order.create(o), 11);
    assert.ok(/INSERT INTO hp_order/.test(last().sql) && /history\)/.test(last().sql));
    assert.strictEqual(last().params.length, 13);
    assert.strictEqual(last().params[12], 'h');

    // 조회: 바인딩, SELECT * 없음
    reply = [[{ id: 1 }]];
    assert.deepStrictEqual(await Order.findByOrderNo('N1'), { id: 1 });
    assert.ok(/WHERE order_no = \?/.test(last().sql));
    await Order.findByTno('T1');
    assert.ok(/WHERE kcp_tno = \?/.test(last().sql));
    await Order.findById(1);
    assert.ok(/WHERE id = \?/.test(last().sql));

    // 전이: status IN 조건, history 이어붙임(줄바꿈 선행), NOW 처리, 바인딩 순서
    reply = [{ affectedRows: 1 }];
    assert.strictEqual(await Order.transition('N1', ['pending', 'awaiting_deposit'], 'paid', { kcp_tno: 'T', paid_at: 'NOW' }, '결제 완료'), true);
    let s = last().sql;
    assert.ok(/status IN \(\?\)/.test(s) && /CONCAT\(history, \?\)/.test(s) && /paid_at = NOW\(\)/.test(s) && /kcp_tno = \?/.test(s) && /WHERE order_no = \?/.test(s));
    assert.deepStrictEqual(last().params, ['paid', 'T', '\n결제 완료', 'N1', ['pending', 'awaiting_deposit']]);
    await Order.transition('N1', ['paid'], 'cancelled', { cancelled_at: 'NOW' }, 'x');
    assert.ok(/cancelled_at = NOW\(\)/.test(last().sql));
    await Order.transition('N1', ['paid'], 'cancelled', { vbank_due: '2026-12-01 00:00:00' }, 'x');
    assert.ok(/vbank_due = \?/.test(last().sql));
    reply = [{ affectedRows: 0 }];
    assert.strictEqual(await Order.transition('N1', ['paid'], 'completed', {}, 'x'), false);
    calls = [];
    await assert.rejects(Order.transition('N1', [], 'completed', {}, 'x'), /fromStatuses/);
    await assert.rejects(Order.transition('N1', 'paid', 'completed', {}, 'x'), /fromStatuses/);
    await assert.rejects(Order.transition('N1', ['paid'], 'completed', { amount: 1 }, 'x'), /허용되지 않은 칸/);
    await assert.rejects(Order.transition('N1', ['paid'], 'completed', { 'status = 1, kcp_tno': 'x' }, 'x'));
    assert.strictEqual(calls.length, 0, '허용 밖 키는 쿼리 전에 throw');

    // 회원 목록: pending 제외, 본인 것만
    reply = [[]];
    await Order.listForMember(3);
    assert.ok(/member_id = \? AND status <> 'pending'/.test(last().sql) && /ORDER BY created_at DESC/.test(last().sql));
    assert.deepStrictEqual(last().params, [3]);
    await Order.findForMember(3, 'N1');
    assert.ok(/member_id = \? AND order_no = \?/.test(last().sql));
    assert.deepStrictEqual(last().params, [3, 'N1']);
    for (const c of calls.slice(-2)) assert.ok(!/admin_memo|history|kcp_/.test(c.sql), '회원용 조회는 내부 칸 제외');

    // 관리 목록: 기본 pending 제외, 필터, 날짜, LIKE 이스케이프
    calls = [];
    pool.query = async (sql, params) => (calls.push({ sql, params }), seen.push(sql), /COUNT\(\*\) AS n/.test(sql) ? [[{ n: 41 }]] : [[{ id: 1 }]]);
    assert.deepStrictEqual(await Order.listForAdmin({ page: 1, size: 20 }), { rows: [{ id: 1 }], total: 41 });
    assert.ok(/status <> 'pending'/.test(calls[0].sql) && !/LIKE/.test(calls[0].sql));
    assert.deepStrictEqual(calls[0].params, [20, 0]);
    calls = [];
    await Order.listForAdmin({ status: 'pending', payMethod: 'card', from: '2026-11-01', to: '2026-11-03', q: 'a%b_c\\', page: 2, size: 10 });
    s = calls[0].sql;
    assert.ok(!/<> 'pending'/.test(s) && /status = \?/.test(s) && /pay_method = \?/.test(s));
    assert.ok(/created_at >= \?/.test(s) && /created_at < DATE_ADD\(\?, INTERVAL 1 DAY\)/.test(s) && /order_no LIKE \? OR buyer_name LIKE \? OR product_title LIKE \?/.test(s));
    assert.deepStrictEqual(calls[0].params, ['pending', 'card', '2026-11-01', '2026-11-03', '%a\\%b\\_c\\\\%', '%a\\%b\\_c\\\\%', '%a\\%b\\_c\\\\%', 10, 10]);
    assert.deepStrictEqual(calls[1].params, calls[0].params.slice(0, 7), '건수 쿼리는 같은 조건, 페이지 제외');
    pool.query = async (sql, params) => (calls.push({ sql, params }), seen.push(sql), reply);

    // page·size 문자열도 숫자로 바인딩
    calls = [];
    pool.query = async (sql, params) => (calls.push({ sql, params }), seen.push(sql), /COUNT\(\*\) AS n/.test(sql) ? [[{ n: 0 }]] : [[]]);
    await Order.listForAdmin({ page: '2', size: '10' });
    assert.deepStrictEqual(calls[0].params, [10, 10]);
    await Product.listForAdmin({ page: '2', size: '10' });
    assert.deepStrictEqual(calls[2].params, [10, 10]);
    pool.query = async (sql, params) => (calls.push({ sql, params }), seen.push(sql), reply);

    // 입금 대기 건수·메모·존재 확인·기록 추가
    reply = [[{ n: '4' }]];
    assert.strictEqual(await Order.awaitingCount(), 4);
    assert.ok(/status = 'awaiting_deposit'/.test(last().sql));
    assert.strictEqual(await Order.hasOrders(2), true);
    reply = [[{ n: 0 }]];
    assert.strictEqual(await Order.hasOrders(2), false);
    reply = [[{ n: '4' }]];
    reply = [{ affectedRows: 1 }];
    assert.strictEqual(await Order.setAdminMemo(1, 'm'), true);
    assert.deepStrictEqual(last().params, ['m', 1]);
    assert.strictEqual(await Order.appendHistory('N1', 'L'), true);
    assert.ok(/CONCAT\(history, \?\)/.test(last().sql) && !/status/.test(last().sql));
    assert.deepStrictEqual(last().params, ['\nL', 'N1']);

    assert.ok(!/SELECT\s+\*/i.test(seen.join(' ')), 'SELECT * 금지');
    console.log('checkShopModel OK');
    process.exit(0);
})().catch(err => {
    console.error('checkShopModel 실패', err.message);
    process.exit(1);
});
