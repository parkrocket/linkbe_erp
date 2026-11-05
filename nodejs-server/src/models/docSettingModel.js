const pool = require('../config/dbPromise');

// 계약 설정: 분류(wk_doc_category)·품목 문구(wk_item_template)·양식(wk_doc_template) — 모든 조회·변경은 cp_id 범위
const DocSetting = {};

const DATETIME_F = "'%Y-%m-%d %H:%i:%s'";
const ITEM_COLUMNS = 'id, category_id, group_name, content, unit_price, qty, period, note, kind, sort';

// 같은 범위(table·scope) 행을 sort,id 순으로 불러 두 칸 바꾼 뒤 0부터 다시 번호 매김 (sort가 같게 이전된 데이터도 안전)
// 반환: 움직였으면 true (없거나 맨 끝이면 false)
const moveRow = async (table, scopeSql, scopeParams, id, dir) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(`SELECT id FROM ${table} WHERE ${scopeSql} ORDER BY sort, id FOR UPDATE`, scopeParams);
        const ids = rows.map(r => r.id);
        const from = ids.indexOf(id);
        const to = dir === 'up' ? from - 1 : from + 1;
        if (from < 0 || to < 0 || to >= ids.length) {
            await conn.rollback();
            return false;
        }
        [ids[from], ids[to]] = [ids[to], ids[from]];
        for (let i = 0; i < ids.length; i += 1) {
            await conn.query(`UPDATE ${table} SET sort = ? WHERE id = ? AND ${scopeSql}`, [i, ids[i], ...scopeParams]);
        }
        await conn.commit();
        return true;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// ---- 분류 ----
DocSetting.listCategories = async cpId => {
    const [rows] = await pool.query(
        'SELECT c.id, c.name, c.sort, (SELECT COUNT(*) FROM wk_contract k WHERE k.cp_id = c.cp_id AND k.category_id = c.id) AS used FROM wk_doc_category c WHERE c.cp_id = ? ORDER BY c.sort, c.id',
        [cpId],
    );
    return rows.map(r => ({ ...r, used: Number(r.used) }));
};

DocSetting.createCategory = async (cpId, { name }) => {
    const [result] = await pool.query(
        'INSERT INTO wk_doc_category (cp_id, name, sort) SELECT ?, ?, COALESCE(MAX(sort), 0) + 1 FROM wk_doc_category WHERE cp_id = ?',
        [cpId, name, cpId],
    );
    return result.insertId;
};

DocSetting.renameCategory = async (cpId, id, { name }) => {
    const [result] = await pool.query('UPDATE wk_doc_category SET name = ? WHERE cp_id = ? AND id = ?', [name, cpId, id]);
    return result.affectedRows === 1;
};

DocSetting.moveCategory = (cpId, id, dir) => moveRow('wk_doc_category', 'cp_id = ?', [cpId], id, dir);

// ponytail: 확인과 삭제 사이 동시 생성은 막지 않음(소수 관리자 설정 화면) — 필요하면 FOR UPDATE
DocSetting.removeCategory = async (cpId, id) => {
    const [rows] = await pool.query('SELECT id FROM wk_doc_category WHERE cp_id = ? AND id = ?', [cpId, id]);
    if (!rows.length) return 'missing';
    const [[{ n }]] = await pool.query(
        'SELECT (SELECT COUNT(*) FROM wk_contract WHERE cp_id = ? AND category_id = ?) + (SELECT COUNT(*) FROM wk_item_template WHERE cp_id = ? AND category_id = ?) + (SELECT COUNT(*) FROM wk_doc_template WHERE cp_id = ? AND category_id = ?) AS n',
        [cpId, id, cpId, id, cpId, id],
    );
    if (Number(n) > 0) return 'used';
    await pool.query('DELETE FROM wk_doc_category WHERE cp_id = ? AND id = ?', [cpId, id]);
    return 'ok';
};

// ---- 품목 문구 ----
DocSetting.listItemTemplates = async (cpId, categoryId) => {
    const [rows] = await pool.query(`SELECT ${ITEM_COLUMNS} FROM wk_item_template WHERE cp_id = ? AND category_id = ? ORDER BY sort, id`, [cpId, categoryId]);
    return rows;
};

// 반환: 새 id, 분류가 이 회사 것이 아니면 null
DocSetting.createItemTemplate = async (cpId, v) => {
    const [cat] = await pool.query(
        'SELECT COALESCE((SELECT MAX(sort) FROM wk_item_template WHERE cp_id = ? AND category_id = c.id), 0) + 1 AS next FROM wk_doc_category c WHERE c.cp_id = ? AND c.id = ?',
        [cpId, cpId, v.categoryId],
    );
    if (!cat.length) return null;
    const [result] = await pool.query(
        'INSERT INTO wk_item_template (cp_id, category_id, group_name, content, unit_price, qty, period, note, kind, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [cpId, v.categoryId, v.groupName, v.content, v.unitPrice, v.qty, v.period, v.note, v.kind, cat[0].next],
    );
    return result.insertId;
};

DocSetting.updateItemTemplate = async (cpId, id, v) => {
    const [result] = await pool.query(
        'UPDATE wk_item_template SET group_name = ?, content = ?, unit_price = ?, qty = ?, period = ?, note = ?, kind = ? WHERE cp_id = ? AND id = ?',
        [v.groupName, v.content, v.unitPrice, v.qty, v.period, v.note, v.kind, cpId, id],
    );
    return result.affectedRows === 1;
};

DocSetting.removeItemTemplate = async (cpId, id) => {
    const [result] = await pool.query('DELETE FROM wk_item_template WHERE cp_id = ? AND id = ?', [cpId, id]);
    return result.affectedRows === 1;
};

DocSetting.moveItemTemplate = async (cpId, id, dir) => {
    const [rows] = await pool.query('SELECT category_id FROM wk_item_template WHERE cp_id = ? AND id = ?', [cpId, id]);
    if (!rows.length) return false;
    return moveRow('wk_item_template', 'cp_id = ? AND category_id = ?', [cpId, rows[0].category_id], id, dir);
};

// ---- 양식 ----
DocSetting.listDocTemplates = async cpId => {
    const [rows] = await pool.query(
        `SELECT id, kind, name, group_name, category_id, is_default, DATE_FORMAT(updated_at, ${DATETIME_F}) AS updated_at FROM wk_doc_template WHERE cp_id = ? ORDER BY kind, id`,
        [cpId],
    );
    return rows;
};

DocSetting.findDocTemplate = async (cpId, id) => {
    const [rows] = await pool.query(
        `SELECT id, kind, name, group_name, category_id, body_html, css, is_default, DATE_FORMAT(updated_at, ${DATETIME_F}) AS updated_at FROM wk_doc_template WHERE cp_id = ? AND id = ?`,
        [cpId, id],
    );
    return rows[0];
};

const categoryOk = async (conn, cpId, categoryId) => {
    if (!categoryId) return true;
    const [rows] = await conn.query('SELECT id FROM wk_doc_category WHERE cp_id = ? AND id = ?', [cpId, categoryId]);
    return rows.length > 0;
};

// 같은 (종류, 분류[NULL 포함])의 다른 기본 양식 끄기
const clearOtherDefaults = (conn, cpId, v, exceptId) =>
    conn.query('UPDATE wk_doc_template SET is_default = 0 WHERE cp_id = ? AND kind = ? AND category_id <=> ? AND id <> ?', [cpId, v.kind, v.categoryId, exceptId]);

// 반환: 새 id, 분류가 이 회사 것이 아니면 null
DocSetting.createDocTemplate = async (cpId, v) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        if (!(await categoryOk(conn, cpId, v.categoryId))) {
            await conn.rollback();
            return null;
        }
        const [result] = await conn.query(
            'INSERT INTO wk_doc_template (cp_id, kind, name, group_name, category_id, body_html, css, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [cpId, v.kind, v.name, v.groupName ?? null, v.categoryId, v.bodyHtml, v.css, v.isDefault ? 1 : 0],
        );
        if (v.isDefault) await clearOtherDefaults(conn, cpId, v, result.insertId);
        await conn.commit();
        return result.insertId;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// 반환: 'ok' | 'changed' | 'missing' | 'invalid'(분류가 다른 회사 것)
DocSetting.updateDocTemplate = async (cpId, id, v) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        if (!(await categoryOk(conn, cpId, v.categoryId))) {
            await conn.rollback();
            return 'invalid';
        }
        const [result] = await conn.query(
            `UPDATE wk_doc_template SET kind = ?, name = ?, group_name = ?, category_id = ?, body_html = ?, css = ?, is_default = ?, updated_at = NOW() WHERE cp_id = ? AND id = ? AND DATE_FORMAT(updated_at, ${DATETIME_F}) = ?`,
            [v.kind, v.name, v.groupName ?? null, v.categoryId, v.bodyHtml, v.css, v.isDefault ? 1 : 0, cpId, id, v.updatedAt || ''],
        );
        if (result.affectedRows === 0) {
            const [rows] = await conn.query('SELECT id FROM wk_doc_template WHERE cp_id = ? AND id = ?', [cpId, id]);
            await conn.rollback();
            return rows.length ? 'changed' : 'missing';
        }
        if (v.isDefault) await clearOtherDefaults(conn, cpId, v, id);
        await conn.commit();
        return 'ok';
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

DocSetting.removeDocTemplate = async (cpId, id) => {
    const [result] = await pool.query('DELETE FROM wk_doc_template WHERE cp_id = ? AND id = ?', [cpId, id]);
    return result.affectedRows === 1;
};

module.exports = DocSetting;
