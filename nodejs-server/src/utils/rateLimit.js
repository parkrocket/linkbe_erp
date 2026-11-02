// 요청 제한 — ponytail: 프로세스 메모리 — pm2 인스턴스 1개 기준, 여러 개면 DB·Redis로
const hits = new Map(); // key -> { times: 요청 시각 배열, windowMs }
let lastSweep = 0;

const recent = (key, windowMs, now) => (hits.get(key)?.times || []).filter(t => now - t < windowMs);

// 허용이면 true(횟수에 포함), 한도 초과면 false
exports.hit = (key, max, windowMs) => {
    const now = Date.now();
    // 오래된 키 정리 — 60초에 한 번, 키별 창이 지난 것만
    if (now - lastSweep >= 60000) {
        lastSweep = now;
        for (const [k, v] of hits) if (now - v.times[v.times.length - 1] >= v.windowMs) hits.delete(k);
    }
    const times = recent(key, windowMs, now);
    const allowed = times.length < max;
    if (allowed) times.push(now);
    hits.set(key, { times, windowMs });
    return allowed;
};

exports.isBlocked = (key, max, windowMs) => recent(key, windowMs, Date.now()).length >= max;
exports.clear = key => hits.delete(key);
exports.reset = () => hits.clear();
exports.size = () => hits.size;
