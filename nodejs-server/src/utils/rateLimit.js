// 요청 제한 — ponytail: 프로세스 메모리 — pm2 인스턴스 1개 기준, 여러 개면 DB·Redis로
const hits = new Map(); // key -> 요청 시각 배열

const recent = (key, windowMs, now) => (hits.get(key) || []).filter(t => now - t < windowMs);

// 허용이면 true(횟수에 포함), 한도 초과면 false
exports.hit = (key, max, windowMs) => {
    const now = Date.now();
    // 오래된 키 정리 (키의 마지막 요청이 1시간 넘었으면 삭제)
    for (const [k, v] of hits) if (now - v[v.length - 1] > 3600000) hits.delete(k);
    const list = recent(key, windowMs, now);
    if (list.length >= max) {
        hits.set(key, list);
        return false;
    }
    list.push(now);
    hits.set(key, list);
    return true;
};

exports.isBlocked = (key, max, windowMs) => recent(key, windowMs, Date.now()).length >= max;
exports.clear = key => hits.delete(key);
exports.reset = () => hits.clear();
