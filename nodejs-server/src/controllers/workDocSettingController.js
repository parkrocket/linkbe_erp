const DocSetting = require('../models/docSettingModel');
const { validateCategory, validateItemTemplate, validateDocTemplate } = require('../utils/contractValidation');
const { sanitizeDocTemplate, sanitizeDocCss } = require('../utils/sanitizeDoc');

// 계약 설정 API(분류·품목 문구·양식) — requireAuth·requireWorkDoc 뒤. 모든 조회·변경은 req.userCpId 범위

const fail = (res, code, error) => res.status(code).json({ error });
const notFound = res => fail(res, 404, 'Not found');

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('work doc setting api error:', error.message);
        if (!res.headersSent) fail(res, 500, 'Database query error');
    }
};

// 형식이 틀린 id는 null (404 처리)
const parseId = value => (/^[1-9]\d{0,14}$/.test(String(value)) ? Number(value) : null);

const toCategory = r => ({ id: r.id, name: r.name, sort: r.sort, used: r.used });
const toItemTemplate = r => ({
    id: r.id, categoryId: r.category_id, groupName: r.group_name, content: r.content, unitPrice: r.unit_price,
    qty: r.qty, period: r.period, note: r.note, kind: r.kind, sort: r.sort,
});
const toTemplateSummary = r => ({ id: r.id, kind: r.kind, name: r.name, groupName: r.group_name ?? null, categoryId: r.category_id, isDefault: !!r.is_default, updatedAt: r.updated_at });

exports.overview = handle(async (req, res) => {
    const [categories, docTemplates] = await Promise.all([DocSetting.listCategories(req.userCpId), DocSetting.listDocTemplates(req.userCpId)]);
    res.json({ categories: categories.map(toCategory), docTemplates: docTemplates.map(toTemplateSummary) });
});

// ---- 분류 ----
exports.createCategory = handle(async (req, res) => {
    const checked = validateCategory(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    res.json({ id: await DocSetting.createCategory(req.userCpId, checked.value) });
});

exports.renameCategory = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const checked = validateCategory(req.body);
    if (!id) return notFound(res);
    if (!checked.ok) return fail(res, 400, checked.error);
    if (!(await DocSetting.renameCategory(req.userCpId, id, checked.value))) return notFound(res);
    res.json({ ok: true });
});

const moveHandler = modelMove =>
    handle(async (req, res) => {
        const id = parseId(req.params.id);
        if (!id) return notFound(res);
        const dir = (req.body || {}).dir;
        if (dir !== 'up' && dir !== 'down') return fail(res, 400, 'Invalid dir');
        // 맨 끝이라 안 움직여도 오류는 아님 (moved로 구분)
        res.json({ ok: true, moved: await modelMove(req.userCpId, id, dir) });
    });
exports.moveCategory = moveHandler((cp, id, dir) => DocSetting.moveCategory(cp, id, dir));
exports.moveItemTemplate = moveHandler((cp, id, dir) => DocSetting.moveItemTemplate(cp, id, dir));

exports.removeCategory = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const result = await DocSetting.removeCategory(req.userCpId, id);
    if (result === 'missing') return notFound(res);
    if (result === 'used') return fail(res, 409, 'In use');
    res.json({ ok: true });
});

// ---- 품목 문구 ----
exports.itemTemplates = handle(async (req, res) => {
    const categoryId = parseId(req.query.categoryId);
    if (!categoryId) return fail(res, 400, 'Invalid categoryId');
    res.json({ itemTemplates: (await DocSetting.listItemTemplates(req.userCpId, categoryId)).map(toItemTemplate) });
});

exports.createItemTemplate = handle(async (req, res) => {
    const checked = validateItemTemplate(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const id = await DocSetting.createItemTemplate(req.userCpId, checked.value);
    if (!id) return fail(res, 400, 'Invalid categoryId'); // 다른 회사 분류
    res.json({ id });
});

exports.updateItemTemplate = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const checked = validateItemTemplate(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    if (!(await DocSetting.updateItemTemplate(req.userCpId, id, checked.value))) return notFound(res);
    res.json({ ok: true });
});

exports.removeItemTemplate = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id || !(await DocSetting.removeItemTemplate(req.userCpId, id))) return notFound(res);
    res.json({ ok: true });
});

// ---- 양식 ----
// 저장·출력 둘 다 정제 (옛 데이터·직접 DB 입력에 스크립트가 있어도 막음)
exports.docTemplateDetail = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const row = id && (await DocSetting.findDocTemplate(req.userCpId, id));
    if (!row) return notFound(res);
    res.json({
        docTemplate: { ...toTemplateSummary(row), bodyHtml: sanitizeDocTemplate(row.body_html), css: sanitizeDocCss(row.css) },
    });
});

const cleanTemplate = value => ({ ...value, bodyHtml: sanitizeDocTemplate(value.bodyHtml), css: sanitizeDocCss(value.css) });

exports.createDocTemplate = handle(async (req, res) => {
    const checked = validateDocTemplate(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const id = await DocSetting.createDocTemplate(req.userCpId, cleanTemplate(checked.value));
    if (!id) return fail(res, 400, 'Invalid categoryId');
    res.json({ id });
});

exports.updateDocTemplate = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const checked = validateDocTemplate(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const result = await DocSetting.updateDocTemplate(req.userCpId, id, cleanTemplate(checked.value));
    if (result === 'missing') return notFound(res);
    if (result === 'changed') return fail(res, 409, 'Template changed');
    if (result === 'invalid') return fail(res, 400, 'Invalid categoryId');
    res.json({ ok: true });
});

exports.removeDocTemplate = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id || !(await DocSetting.removeDocTemplate(req.userCpId, id))) return notFound(res);
    res.json({ ok: true });
});
