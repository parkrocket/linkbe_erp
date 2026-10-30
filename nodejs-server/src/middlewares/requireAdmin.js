// 관리자 전용 API — requireAuth 뒤에 사용 (req.userRole은 requireAuth가 DB에서 읽어 설정)
function requireAdmin(req, res, next) {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin only' });
    }
    next();
}

module.exports = { requireAdmin };
