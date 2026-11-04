// 거래처 접속정보 API — requireAuth 뒤에 사용 (req.clientSecret은 requireAuth가 DB에서 읽어 설정, 관리자 포함)
function requireClientSecret(req, res, next) {
    if (req.clientSecret !== true) {
        return res.status(403).json({ error: 'Client secret only' });
    }
    next();
}

module.exports = { requireClientSecret };
