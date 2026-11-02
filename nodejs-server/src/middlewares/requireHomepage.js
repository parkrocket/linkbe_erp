// 홈페이지 관리 권한 — hibye 관리자 또는 홈페이지 권한을 받은 직원 (requireAuth가 매 요청 DB에서 설정)
exports.requireHomepage = (req, res, next) => {
    if (req.userRole === 'admin' || req.userHomepage === true) return next();
    res.status(403).json({ error: 'Homepage only' });
};
