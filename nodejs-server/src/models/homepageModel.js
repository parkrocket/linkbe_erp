const pool = require('../config/dbPromise');

// 회사 홈페이지(linkbe.kr) 콘텐츠·문의·파일 — hp_ 테이블
// 공개 조회(visibleOnly)는 숨김 글을 절대 내보내지 않음. 모든 값은 바인딩
const Homepage = {};

const POST_LIST_COLUMNS = 'id, board, title, thumbnail_file_id, client, category, site_url, show_on_main, sort_order, is_visible, created_at, updated_at';
const POST_COLUMNS = `${POST_LIST_COLUMNS}, body_html`;

// ── 글(공지·포트폴리오) ──
Homepage.listPosts = async (board, { visibleOnly = true, mainOnly = false, page = 1, size = 20 } = {}) => {
    const where = ['board = ?', ...(visibleOnly ? ['is_visible = 1'] : []), ...(mainOnly ? ['show_on_main = 1'] : [])].join(' AND ');
    const [rows] = await pool.query(
        `SELECT ${POST_LIST_COLUMNS} FROM hp_post WHERE ${where} ORDER BY sort_order DESC, id DESC LIMIT ? OFFSET ?`,
        [board, size, (page - 1) * size],
    );
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM hp_post WHERE ${where}`, [board]);
    return { rows, total: Number(n) };
};

Homepage.findPost = async (board, id, { visibleOnly = true } = {}) => {
    const [rows] = await pool.query(
        `SELECT ${POST_COLUMNS} FROM hp_post WHERE board = ? AND id = ?${visibleOnly ? ' AND is_visible = 1' : ''}`,
        [board, id],
    );
    return rows[0];
};

// fields: { title, bodyHtml(정제됨), thumbnailFileId, client, category, siteUrl, showOnMain, sortOrder, isVisible }
Homepage.savePost = async (board, id, f, mbNo) => {
    const values = [f.title, f.bodyHtml, f.thumbnailFileId, f.client, f.category, f.siteUrl, f.showOnMain, f.sortOrder, f.isVisible];
    if (!id) {
        const [result] = await pool.query(
            'INSERT INTO hp_post (title, body_html, thumbnail_file_id, client, category, site_url, show_on_main, sort_order, is_visible, board, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [...values, board, mbNo],
        );
        return result.insertId;
    }
    await pool.query(
        'UPDATE hp_post SET title = ?, body_html = ?, thumbnail_file_id = ?, client = ?, category = ?, site_url = ?, show_on_main = ?, sort_order = ?, is_visible = ? WHERE id = ? AND board = ?',
        [...values, id, board],
    );
    return id;
};

Homepage.deletePost = (board, id) => pool.query('DELETE FROM hp_post WHERE id = ? AND board = ?', [id, board]);

// ── FAQ ──
Homepage.listFaqs = async ({ visibleOnly = true } = {}) => {
    const [rows] = await pool.query(
        `SELECT id, question, answer_html, sort_order, is_visible FROM hp_faq${visibleOnly ? ' WHERE is_visible = 1' : ''} ORDER BY sort_order, id`,
    );
    return rows;
};

Homepage.saveFaq = async (id, { question, answerHtml, isVisible }) => {
    if (!id) {
        const [result] = await pool.query(
            'INSERT INTO hp_faq (question, answer_html, is_visible, sort_order) SELECT ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM hp_faq',
            [question, answerHtml, isVisible],
        );
        return result.insertId;
    }
    await pool.query('UPDATE hp_faq SET question = ?, answer_html = ?, is_visible = ? WHERE id = ?', [question, answerHtml, isVisible, id]);
    return id;
};

Homepage.deleteFaq = id => pool.query('DELETE FROM hp_faq WHERE id = ?', [id]);

// 이웃과 자리 바꾸기 — 전체를 1부터 다시 매김(같은 순서값도 정상 처리). 반환: 대상이 있었는지
Homepage.moveFaq = async (id, direction) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT id, sort_order FROM hp_faq ORDER BY sort_order, id FOR UPDATE');
        const index = rows.findIndex(r => r.id === id);
        if (index < 0) {
            await conn.rollback();
            return false;
        }
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target >= 0 && target < rows.length) [rows[index], rows[target]] = [rows[target], rows[index]];
        for (const [i, row] of rows.entries()) {
            if (row.sort_order !== i + 1) await conn.query('UPDATE hp_faq SET sort_order = ? WHERE id = ?', [i + 1, row.id]);
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

// ── 팝업 ── activeAt: 공개(그 시각에 보이는 것만), null: 관리(전체)
Homepage.listPopups = async ({ activeAt = null } = {}) => {
    const columns = 'id, title, image_file_id, link_url, starts_at, ends_at, pos_left, pos_top, width, is_visible';
    const [rows] = activeAt
        ? await pool.query(`SELECT ${columns} FROM hp_popup WHERE is_visible = 1 AND starts_at <= ? AND ends_at >= ? ORDER BY id DESC`, [activeAt, activeAt])
        : await pool.query(`SELECT ${columns} FROM hp_popup ORDER BY id DESC`);
    return rows;
};

// fields: { title, imageFileId, linkUrl, startsAt, endsAt, posLeft, posTop, width, isVisible }
Homepage.savePopup = async (id, f) => {
    const values = [f.title, f.imageFileId, f.linkUrl, f.startsAt, f.endsAt, f.posLeft, f.posTop, f.width, f.isVisible];
    if (!id) {
        const [result] = await pool.query(
            'INSERT INTO hp_popup (title, image_file_id, link_url, starts_at, ends_at, pos_left, pos_top, width, is_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            values,
        );
        return result.insertId;
    }
    await pool.query(
        'UPDATE hp_popup SET title = ?, image_file_id = ?, link_url = ?, starts_at = ?, ends_at = ?, pos_left = ?, pos_top = ?, width = ?, is_visible = ? WHERE id = ?',
        [...values, id],
    );
    return id;
};

Homepage.deletePopup = id => pool.query('DELETE FROM hp_popup WHERE id = ?', [id]);

// ── 안내 페이지 ──
Homepage.listPages = async () => {
    const [rows] = await pool.query('SELECT slug, title, updated_at FROM hp_page ORDER BY slug');
    return rows;
};

Homepage.getPage = async slug => {
    const [rows] = await pool.query('SELECT slug, title, body_html, updated_at FROM hp_page WHERE slug = ?', [slug]);
    return rows[0];
};

Homepage.savePage = (slug, title, bodyHtml, mbNo) =>
    pool.query(
        'INSERT INTO hp_page (slug, title, body_html, updated_by) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), body_html = VALUES(body_html), updated_by = VALUES(updated_by)',
        [slug, title, bodyHtml, mbNo],
    );

// ── 문의 ──
const INQUIRY_COLUMNS = 'id, kind, name, phone, company, email, category, contact_method, body, status, admin_memo, created_at';

// conn: 첨부와 함께 저장하는 트랜잭션 연결(없으면 pool)
Homepage.createInquiry = async ({ kind, name, phone, company, email, category, contactMethod, body, ip }, conn = pool) => {
    const [result] = await conn.query(
        'INSERT INTO hp_inquiry (kind, name, phone, company, email, category, contact_method, body, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [kind, name, phone, company, email, category, contactMethod, body, ip],
    );
    return result.insertId;
};

// 문의 + 첨부를 한 트랜잭션으로 (하나라도 실패하면 둘 다 취소)
Homepage.createInquiryWithFiles = async (inquiry, files) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const id = await Homepage.createInquiry(inquiry, conn);
        for (const f of files) await Homepage.insertFile({ ownerType: 'inquiry', ownerId: id, visibility: 'private', ...f }, conn);
        await conn.commit();
        return id;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

Homepage.listInquiries = async ({ kind = null, status = null, page = 1, size = 30 } = {}) => {
    const conds = [...(kind ? ['kind = ?'] : []), ...(status ? ['status = ?'] : [])];
    const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
    const params = [...(kind ? [kind] : []), ...(status ? [status] : [])];
    // 목록은 본문 제외 (개인정보 최소)
    const [rows] = await pool.query(
        `SELECT id, kind, name, company, category, status, created_at FROM hp_inquiry${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...params, size, (page - 1) * size],
    );
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM hp_inquiry${where}`, params);
    return { rows, total: Number(n) };
};

Homepage.findInquiry = async id => {
    const [rows] = await pool.query(`SELECT ${INQUIRY_COLUMNS} FROM hp_inquiry WHERE id = ?`, [id]);
    return rows[0];
};

Homepage.updateInquiry = (id, { status, adminMemo }) =>
    pool.query('UPDATE hp_inquiry SET status = ?, admin_memo = ? WHERE id = ?', [status, adminMemo, id]);

// 스팸 판정용 — 같은 IP의 최근 N분 접수 건수
Homepage.countRecentByIp = async (ip, minutes) => {
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM hp_inquiry WHERE ip = ? AND created_at >= NOW() - INTERVAL ? MINUTE', [
        ip,
        minutes,
    ]);
    return Number(n);
};

// ── 파일 ──
Homepage.insertFile = async ({ ownerType = null, ownerId = null, visibility, originalName, storedName, mime, size }, conn = pool) => {
    const [result] = await conn.query(
        'INSERT INTO hp_file (owner_type, owner_id, visibility, original_name, stored_name, mime, size) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [ownerType, ownerId, visibility, originalName, storedName, mime, size],
    );
    return result.insertId;
};

Homepage.findFile = async id => {
    const [rows] = await pool.query(
        'SELECT id, owner_type, owner_id, visibility, original_name, stored_name, mime, size FROM hp_file WHERE id = ?',
        [id],
    );
    return rows[0];
};

Homepage.listFiles = async (ownerType, ownerId) => {
    const [rows] = await pool.query(
        'SELECT id, original_name, mime, size FROM hp_file WHERE owner_type = ? AND owner_id = ? ORDER BY id',
        [ownerType, ownerId],
    );
    return rows;
};

module.exports = Homepage;
