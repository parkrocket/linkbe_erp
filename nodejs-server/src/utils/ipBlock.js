const net = require('net');
const pool = require('../config/dbPromise');

// hibye.kr 접속 차단 IP — 목록(lk_blocked_ip)을 메모리에 두고 30초마다 다시 읽음, 추가·해제 시 바로 다시 읽음
// DB를 못 읽으면 직전 목록 유지(처음부터 못 읽으면 아무도 막지 않음 — 사이트 전체가 닫히지 않게)
// ponytail: 프로세스 메모리 캐시(pm2 1개 전제), 여러 개로 늘리면 해제 반영이 최대 30초 늦음
const REFRESH_MS = 30 * 1000;
let blocked = new Set();
let loadedAt = 0;
let loading = null;

// '::ffff:1.2.3.4' → '1.2.3.4', 앞뒤 공백 제거. IP 형식이 아니면 ''
const normalizeIp = value => {
    const s = String(value ?? '').trim();
    const v4 = s.startsWith('::ffff:') ? s.slice(7) : s;
    return net.isIP(v4) ? v4.toLowerCase() : '';
};

// 차단할 수 없는 IP — 사무실(COMPANY_IP, 쉼표로 여러 개), 루프백(서버 자신)
const protectedIps = () =>
    new Set(
        String(process.env.COMPANY_IP ?? '')
            .split(',')
            .map(normalizeIp)
            .filter(Boolean)
            .concat(['127.0.0.1', '::1']),
    );

async function reload() {
    const [rows] = await pool.query('SELECT ip FROM lk_blocked_ip');
    blocked = new Set(rows.map(r => r.ip));
    loadedAt = Date.now();
}

// 오래됐으면 다시 읽기(동시에 여러 번 읽지 않게 한 번만)
async function fresh() {
    if (Date.now() - loadedAt < REFRESH_MS) return;
    loading = loading || reload().catch(e => console.error('blocked ip load failed:', e.message)).finally(() => (loading = null));
    await loading;
}

const invalidate = () => {
    loadedAt = 0;
    return fresh();
};

async function isBlocked(ip) {
    await fresh();
    return blocked.has(normalizeIp(ip));
}

// 차단 검사에서 빼는 경로(/api 기준): linkbe.kr이 쓰는 공개 API, Slack 서버 호출, 헬스체크, 화면 서버용 목록
const SKIP_PREFIXES = ['/public/', '/slack/', '/internal/'];

// /api 미들웨어 — 차단 IP는 로그인·모든 직원 API 403
async function blockMiddleware(req, res, next) {
    if (req.path === '/test' || SKIP_PREFIXES.some(p => req.path.startsWith(p))) return next();
    if (await isBlocked(req.ip)) return res.status(403).json({ error: 'Blocked ip' });
    next();
}

// 화면 서버(hibye-web proxy.ts)가 페이지 진입을 막을 때 읽는 목록 — 같은 서버 안에서 직접 부른 요청만
// (nginx를 거친 요청은 X-Forwarded-For가 붙고 req.ip가 방문자 IP라 거절됨)
async function internalList(req, res) {
    const local = ['127.0.0.1', '::1'].includes(normalizeIp(req.ip)) && !req.headers['x-forwarded-for'];
    if (!local) return res.status(404).json({ error: 'Not found' });
    await fresh();
    res.set('Cache-Control', 'no-store').json({ ips: [...blocked] });
}

module.exports = { normalizeIp, protectedIps, isBlocked, invalidate, blockMiddleware, internalList };
