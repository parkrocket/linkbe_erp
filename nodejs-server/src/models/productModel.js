const pool = require('../config/dbPromise');
const Order = require('./orderModel');

// 개인결제 상품(hp_product) — 모든 값은 바인딩, 명시 컬럼만
const Product = {};

const DETAIL_COLUMNS = 'id, title, price, body_html, image_file_id, is_visible, sort_order, updated_at';

// 공개 목록: 판매 중인 것만, 본문 제외
Product.listVisible = async () => {
    const [rows] = await pool.query(
        'SELECT id, title, price, image_file_id FROM hp_product WHERE is_visible = 1 ORDER BY sort_order, id DESC',
    );
    return rows;
};

Product.findVisible = async id => {
    const [rows] = await pool.query(`SELECT ${DETAIL_COLUMNS} FROM hp_product WHERE id = ? AND is_visible = 1`, [id]);
    return rows[0];
};

Product.findById = async id => {
    const [rows] = await pool.query(`SELECT ${DETAIL_COLUMNS} FROM hp_product WHERE id = ?`, [id]);
    return rows[0];
};

// 관리 목록: 본문 제외, 주문 건수 포함
Product.listForAdmin = async ({ page = 1, size = 20 } = {}) => {
    page = Number(page);
    size = Number(size);
    const [rows] = await pool.query(
        'SELECT p.id, p.title, p.price, p.image_file_id, p.is_visible, p.sort_order, p.updated_at, (SELECT COUNT(*) FROM hp_order o WHERE o.product_id = p.id) AS order_count FROM hp_product p ORDER BY p.sort_order, p.id DESC LIMIT ? OFFSET ?',
        [size, (page - 1) * size],
    );
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM hp_product');
    return { rows, total: Number(n) };
};

// id가 없으면 등록(새 id), 있으면 수정(id). 수정 중 다른 사람이 먼저 저장했으면(expectedUpdatedAt 불일치) 'conflict'
Product.save = async (id, { title, price, bodyHtml, imageFileId, isVisible, sortOrder }, actorNo, expectedUpdatedAt = null) => {
    if (!id) {
        const [result] = await pool.query(
            'INSERT INTO hp_product (title, price, body_html, image_file_id, is_visible, sort_order, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, price, bodyHtml, imageFileId, isVisible, sortOrder, actorNo],
        );
        return result.insertId;
    }
    const params = [title, price, bodyHtml, imageFileId, isVisible, sortOrder, id];
    let where = 'WHERE id = ?';
    if (expectedUpdatedAt) {
        where += ' AND updated_at = ?';
        params.push(expectedUpdatedAt);
    }
    const [result] = await pool.query(
        `UPDATE hp_product SET title = ?, price = ?, body_html = ?, image_file_id = ?, is_visible = ?, sort_order = ? ${where}`,
        params,
    );
    return result.affectedRows === 1 ? id : 'conflict';
};

// 주문이 없을 때만 한 문장으로 삭제(경합 방지). 0행이면 주문 때문인지('has_orders') 없는 상품인지(false) 구분
Product.remove = async id => {
    const [result] = await pool.query(
        'DELETE FROM hp_product WHERE id = ? AND NOT EXISTS (SELECT 1 FROM hp_order WHERE product_id = ?)',
        [id, id],
    );
    if (result.affectedRows === 1) return true;
    return (await Order.hasOrders(id)) ? 'has_orders' : false;
};

module.exports = Product;
