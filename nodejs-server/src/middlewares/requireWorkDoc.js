// 업무 문서(경비·견적·계약서) API — requireAuth 뒤에 사용 (req.workDoc은 requireAuth가 DB에서 읽어 설정, 관리자 포함)
function requireWorkDoc(req, res, next) {
    if (req.workDoc !== true) {
        return res.status(403).json({ error: 'Work doc only' });
    }
    next();
}

module.exports = { requireWorkDoc };
