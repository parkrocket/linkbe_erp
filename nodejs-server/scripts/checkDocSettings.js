// 양식 정제·설정 API 점검: node scripts/checkDocSettings.js  (모델 가짜 — DB 호출 없음)
const assert = require('assert');
const { sanitizeDocTemplate: html, sanitizeDocCss: css } = require('../src/utils/sanitizeDoc');
const DocSetting = require('../src/models/docSettingModel');

// ── HTML 정제 ──
for (const bad of ['<script>x</script>', '<img src=x onerror=alert(1)>', '<a href="javascript:1">a</a>', '<iframe src="https://a.b"></iframe>', '<p onclick="1">a</p>', '<img src="javascript:1">', '<img src="data:image/svg+xml;base64,AAAA">', '<img src="http://a.b/x.png">', '<img src="data:text/html;base64,PHNjcmlwdD4=">', '<p style="background-image:IMAGE-set(\'https://e.x/a.png\' 1x)">a</p>', '<p style="cursor:-webkit-Image-Set(\'https://e.x/a.png\' 1x)">a</p>']) {
    const out = html(bad);
    assert.ok(!/script|onerror|onclick|javascript|iframe|svg|http:|text\/html|image-set|e\.x/i.test(out), `제거 안 됨: ${bad} -> ${out}`);
}
const keep = '<div class="a"><table class="item_table"><colgroup><col width="10" /></colgroup><tr><td colspan="2" rowspan="1" align="center" style="text-align:center;border-bottom:1px solid #000">{업체명} {품목표}</td></tr></table><img src="data:image/png;base64,AAAA" /><h1>t</h1><sup>1</sup></div>';
assert.ok(!/img/.test(html('<img src="https://a.b/x.png">')), 'https 이미지 제거');
assert.ok(/data:image\/jpeg/.test(html('<img src="data:image/jpeg;base64,AAAA">')));
assert.strictEqual(html(keep).replace(/&quot;/g, '"'), keep);
assert.ok(!/url\(/i.test(html('<p style="background:url(javascript:1);color:red">a</p>')));
assert.ok(/color:red/.test(html('<p style="background:url(javascript:1);color:red">a</p>')));
assert.ok(!/foo|behavior/.test(html('<p style="behavior:x;foo:bar">a</p>')));

// ── CSS 정제 ──
for (const bad of ['@import url(x);', 'a{background:url(javascript:1)}', 'a{width:expression(alert(1))}', 'a{behavior:url(x.htc)}', 'a{-moz-binding:url(x)}', 'a{}</style><script>1</script>', 'a{background:ur/**/l(x)}', 'a{background:u\\72l(x)}', 'a{background-image:image-set("https://e.x/a.png" 1x)}', 'a{cursor:-WebKit-Image-Set("https://e.x/a.png" 1x)}', 'a{background:src("x")}']) {
    const out = css(bad);
    assert.ok(!/url\s*\(|expression|behavior|-moz-binding|<\/style|@import|image-set|src\s*\(/i.test(out), `CSS 제거 안 됨: ${bad} -> ${out}`);
}
assert.strictEqual(css('.b_line{border-bottom:1px solid #000}'), '.b_line{border-bottom:1px solid #000}');
assert.strictEqual(css('.a > .b{color:red}'), '.a > .b{color:red}');

// ── 설정 API ──
const ctrl = require('../src/controllers/workDocSettingController');
const calls = {};
const rec = (name, ret) => async (...a) => ((calls[name] = a), typeof ret === 'function' ? ret(...a) : ret);
const tpl = { id: 5, kind: 'estimate', name: '기본', category_id: null, body_html: '<p>{업체명}</p><script>x</script>', css: 'a{background:url(x)}', is_default: 1, updated_at: '2026-11-04 10:00:00' };
DocSetting.listCategories = rec('cats', [{ id: 1, name: '웹', sort: 1, used: 2 }]);
DocSetting.listDocTemplates = rec('tpls', [{ id: 5, kind: 'estimate', name: '기본', category_id: null, is_default: 1, updated_at: 'u' }]);
DocSetting.findDocTemplate = async (cp, id) => (id === 5 ? tpl : undefined);
DocSetting.listItemTemplates = rec('itpls', [{ id: 1, category_id: 1, group_name: 'g', content: 'c', unit_price: 1, qty: 1, period: 1, note: '', kind: 'normal', sort: 1 }]);
DocSetting.createCategory = rec('createCat', 9);
DocSetting.renameCategory = rec('rename', true);
DocSetting.moveCategory = rec('moveCat', true);
let removeResult = 'ok';
DocSetting.removeCategory = async () => removeResult;
DocSetting.createItemTemplate = rec('createItem', 4);
DocSetting.updateItemTemplate = rec('updateItem', true);
DocSetting.removeItemTemplate = rec('removeItem', true);
DocSetting.moveItemTemplate = rec('moveItem', true);
DocSetting.createDocTemplate = rec('createTpl', 8);
let updateResult = 'ok';
DocSetting.updateDocTemplate = rec('updateTpl', () => updateResult);
DocSetting.removeDocTemplate = rec('removeTpl', true);

const call = async (fn, req) => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    await fn({ params: {}, query: {}, body: {}, userCpId: 1, userId: 'a@x.kr', ...req }, res);
    return res;
};

(async () => {
    let res = await call(ctrl.overview);
    assert.deepStrictEqual(Object.keys(res.body), ['categories', 'docTemplates']);
    assert.deepStrictEqual(Object.keys(res.body.docTemplates[0]), ['id', 'kind', 'name', 'categoryId', 'isDefault', 'updatedAt']);

    res = await call(ctrl.itemTemplates, { query: { categoryId: '1' } });
    assert.strictEqual(calls.itpls[1], 1);
    assert.strictEqual(res.body.itemTemplates[0].unitPrice, 1);
    assert.strictEqual((await call(ctrl.itemTemplates, { query: { categoryId: 'x' } })).code, 400);

    // 양식 상세: 저장된 본문의 스크립트·url은 출력에서도 제거
    res = await call(ctrl.docTemplateDetail, { params: { id: '5' } });
    assert.ok(!/script/.test(res.body.docTemplate.bodyHtml) && /\{업체명\}/.test(res.body.docTemplate.bodyHtml));
    assert.ok(!/url\(/.test(res.body.docTemplate.css));
    assert.strictEqual(res.body.docTemplate.updatedAt, '2026-11-04 10:00:00');
    for (const id of ['abc', '0', '99']) assert.strictEqual((await call(ctrl.docTemplateDetail, { params: { id } })).code, 404);

    // 양식 저장: 정제 후 모델에
    const body = { kind: 'estimate', name: '새', categoryId: 1, bodyHtml: '<p>a</p><script>x</script>', css: 'a{background:url(x)}', isDefault: false };
    res = await call(ctrl.createDocTemplate, { body });
    assert.deepStrictEqual(res.body, { id: 8 });
    assert.ok(!/script/.test(calls.createTpl[1].bodyHtml) && !/url\(/.test(calls.createTpl[1].css));
    assert.strictEqual((await call(ctrl.createDocTemplate, { body: { ...body, kind: 'x' } })).code, 400);
    DocSetting.createDocTemplate = async () => null;
    res = await call(ctrl.createDocTemplate, { body });
    assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid categoryId']);

    res = await call(ctrl.updateDocTemplate, { params: { id: '5' }, body: { ...body, updatedAt: 'u' } });
    assert.deepStrictEqual(res.body, { ok: true });
    assert.ok(!/script/.test(calls.updateTpl[2].bodyHtml));
    for (const [r, code, err] of [['changed', 409, 'Template changed'], ['missing', 404, 'Not found'], ['invalid', 400, 'Invalid categoryId']]) {
        updateResult = r;
        res = await call(ctrl.updateDocTemplate, { params: { id: '5' }, body });
        assert.deepStrictEqual([res.code, res.body.error], [code, err]);
    }
    assert.strictEqual((await call(ctrl.updateDocTemplate, { params: { id: 'x' }, body })).code, 404);
    assert.deepStrictEqual((await call(ctrl.removeDocTemplate, { params: { id: '5' } })).body, { ok: true });
    DocSetting.removeDocTemplate = async () => false;
    assert.strictEqual((await call(ctrl.removeDocTemplate, { params: { id: '5' } })).code, 404);

    // 분류
    assert.deepStrictEqual((await call(ctrl.createCategory, { body: { name: ' 웹 ' } })).body, { id: 9 });
    assert.strictEqual(calls.createCat[1].name, '웹');
    assert.strictEqual((await call(ctrl.createCategory, { body: { name: '' } })).code, 400);
    assert.deepStrictEqual((await call(ctrl.renameCategory, { params: { id: '1' }, body: { name: 'x' } })).body, { ok: true });
    DocSetting.renameCategory = async () => false;
    assert.strictEqual((await call(ctrl.renameCategory, { params: { id: '1' }, body: { name: 'x' } })).code, 404);
    await call(ctrl.moveCategory, { params: { id: '1' }, body: { dir: 'up' } });
    assert.deepStrictEqual(calls.moveCat.slice(1), [1, 'up']);
    assert.strictEqual((await call(ctrl.moveCategory, { params: { id: '1' }, body: { dir: 'left' } })).code, 400);
    removeResult = 'used';
    res = await call(ctrl.removeCategory, { params: { id: '1' } });
    assert.deepStrictEqual([res.code, res.body.error], [409, 'In use']);
    removeResult = 'missing';
    assert.strictEqual((await call(ctrl.removeCategory, { params: { id: '1' } })).code, 404);
    removeResult = 'ok';
    assert.deepStrictEqual((await call(ctrl.removeCategory, { params: { id: '1' } })).body, { ok: true });

    // 품목 문구
    const it = { categoryId: 1, content: '디자인', unitPrice: 1000 };
    assert.deepStrictEqual((await call(ctrl.createItemTemplate, { body: it })).body, { id: 4 });
    assert.strictEqual((await call(ctrl.createItemTemplate, { body: { ...it, content: '' } })).code, 400);
    DocSetting.createItemTemplate = async () => null;
    assert.strictEqual((await call(ctrl.createItemTemplate, { body: it })).body.error, 'Invalid categoryId');
    assert.deepStrictEqual((await call(ctrl.updateItemTemplate, { params: { id: '1' }, body: it })).body, { ok: true });
    assert.strictEqual((await call(ctrl.updateItemTemplate, { params: { id: 'x' }, body: it })).code, 404);
    assert.deepStrictEqual((await call(ctrl.removeItemTemplate, { params: { id: '1' } })).body, { ok: true });
    await call(ctrl.moveItemTemplate, { params: { id: '1' }, body: { dir: 'down' } });
    assert.deepStrictEqual(calls.moveItem.slice(1), [1, 'down']);

    console.log('OK');
})().catch(e => {
    console.error(e);
    process.exit(1);
});
