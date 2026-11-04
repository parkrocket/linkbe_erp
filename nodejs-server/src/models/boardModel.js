const pool = require('../config/dbPromise');

// 바이럴 게시판(wk_board_post·wk_board_comment) — 모든 조회·변경은 cp_id + board 범위, 값은 바인딩.
// 댓글은 cp_id로 확인된 글 범위에서만 다룬다(컨트롤러가 글을 먼저 찾음)
const Board = {};

// LIKE 와일드카드 이스케이프 (ledgerModel과 같은 방식)
const escapeLike = q => q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

const DATETIME_F = "'%Y-%m-%d %H:%i:%s'";
// 표시용 KST 문자열(세션 시간대 → +09:00)
const KST = col => `DATE_FORMAT(CONVERT_TZ(${col}, @@session.time_zone, '+09:00'), ${DATETIME_F})`;

Board.list = async (cpId, board, { q, page = 1, size = 20 } = {}) => {
    const conds = ['p.cp_id = ?', 'p.board = ?'];
    const params = [cpId, board];
    if (q) {
        conds.push('p.title LIKE ?');
        params.push(`%${escapeLike(q)}%`);
    }
    const where = ` WHERE ${conds.join(' AND ')}`;
    // 댓글 수는 상관 서브쿼리(인덱스 idx_post) — 한 페이지(최대 100건)만 계산
    const [rows] = await pool.query(
        `SELECT p.id, p.title, p.writer_name, (SELECT COUNT(*) FROM wk_board_comment c WHERE c.post_id = p.id) AS comment_count, ${KST('p.created_at')} AS created_at
         FROM wk_board_post p${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
        [...params, size, (page - 1) * size],
    );
    const [[count]] = await pool.query(`SELECT COUNT(*) AS n FROM wk_board_post p${where}`, params);
    return { rows, total: Number(count.n) };
};

Board.findPost = async (cpId, board, id) => {
    const [rows] = await pool.query(
        `SELECT id, title, body_html, writer_no, writer_name, ${KST('created_at')} AS created_at, ${KST('updated_at')} AS updated_at
         FROM wk_board_post WHERE cp_id = ? AND board = ? AND id = ?`,
        [cpId, board, id],
    );
    return rows[0];
};

Board.comments = async postId => {
    const [rows] = await pool.query(
        `SELECT id, body, writer_no, writer_name, ${KST('created_at')} AS created_at FROM wk_board_comment WHERE post_id = ? ORDER BY id`,
        [postId],
    );
    return rows;
};

Board.createPost = async (cpId, board, { title, bodyHtml }, writer) => {
    const [result] = await pool.query(
        'INSERT INTO wk_board_post (cp_id, board, title, body_html, writer_no, writer_name) VALUES (?, ?, ?, ?, ?, ?)',
        [cpId, board, title, bodyHtml, writer.no, writer.name],
    );
    return result.insertId;
};

// 반환: 글이 있으면 true (없음·다른 회사면 false)
Board.updatePost = async (cpId, board, id, { title, bodyHtml }) => {
    const [result] = await pool.query('UPDATE wk_board_post SET title = ?, body_html = ? WHERE cp_id = ? AND board = ? AND id = ?', [title, bodyHtml, cpId, board, id]);
    return result.affectedRows > 0;
};

// 글과 댓글을 한 트랜잭션으로 삭제
Board.removePost = async (cpId, board, id) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [post] = await conn.query('DELETE FROM wk_board_post WHERE cp_id = ? AND board = ? AND id = ?', [cpId, board, id]);
        if (post.affectedRows > 0) await conn.query('DELETE FROM wk_board_comment WHERE post_id = ?', [id]);
        await conn.commit();
        return post.affectedRows > 0;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

Board.findComment = async (postId, id) => {
    const [rows] = await pool.query('SELECT id, writer_no FROM wk_board_comment WHERE post_id = ? AND id = ?', [postId, id]);
    return rows[0];
};

Board.createComment = async (postId, body, writer) => {
    const [result] = await pool.query('INSERT INTO wk_board_comment (post_id, body, writer_no, writer_name) VALUES (?, ?, ?, ?)', [postId, body, writer.no, writer.name]);
    return result.insertId;
};

Board.removeComment = async (postId, id) => {
    const [result] = await pool.query('DELETE FROM wk_board_comment WHERE post_id = ? AND id = ?', [postId, id]);
    return result.affectedRows > 0;
};

module.exports = { Board };
