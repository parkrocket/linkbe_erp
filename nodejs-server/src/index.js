const express = require('express');
const cors = require('cors'); // CORS 미들웨어 불러오기
const dotenv = require('dotenv');

// 환경 변수 로드
if (process.env.NODE_ENV === 'production') {
    dotenv.config({ path: '.env.production' });
} else {
    dotenv.config();
}

console.log(process.env.DB_HOST);

const app = express();

const port = 5000;

const requestIp = require('request-ip');
const { requireAuth } = require('./middlewares/requireAuth');
const { requireAdmin } = require('./middlewares/requireAdmin');
const { keepRawBody } = require('./middlewares/verifySlack');

app.use(cors()); // CORS 미들웨어 사용

// 매일 자정 출근상태 초기화 크론 — 로컬이 운영 DB에 붙으므로 운영에서만 실행
if (process.env.NODE_ENV === 'production') {
    require('./controllers/userCron.js');
    require('./controllers/homepageCron.js'); // 홈페이지 문의 3년 보관 후 삭제
    require('./controllers/shopCron.js'); // 개인결제 주문 5년 보관·결제 대기 7일 후 삭제
}

app.use(requestIp.mw());
// 실제 클라이언트 IP(req.ip) — 로드밸런서·nginx만 신뢰 (config/trustProxy.js)
app.set('trust proxy', require('./config/trustProxy').TRUST_PROXY);

// 환경 변수 로드
if (process.env.NODE_ENV === 'production') {
    dotenv.config({ path: '.env.production' });
} else {
    dotenv.config();
}

// CORS 설정

// JSON 요청을 파싱하는 미들웨어
// verify: Slack 서명 검증용 원문 보관
// limit: 관리자 글 본문(최대 500KB HTML)이 들어가도록 1MB (기본 100KB)
app.use(express.json({ limit: '1mb', verify: keepRawBody }));

// /api 전체에 로그인(JWT 쿠키) 검사 — 예외 경로는 requireAuth.js 참고
app.use('/api', requireAuth);

// 라우터 설정

const listRoutes = require('./routes/list');
const userRoutes = require('./routes/user');
const gtwRoutes = require('./routes/gtw');
const companyRoutes = require('./routes/company');
const slackRoutes = require('./routes/slack');
const vacationRoutes = require('./routes/vacation');
const applyRoutes = require('./routes/apply');
const calendarRoutes = require('./routes/calendar');

app.use('/api/users', userRoutes);

app.use('/api/gtw', gtwRoutes);

app.use('/api/list', listRoutes);

app.use('/api/company', companyRoutes);

app.use('/api/slack', slackRoutes);

app.use('/api/vacation', vacationRoutes);

app.use('/api/apply', applyRoutes);

app.use('/api/calendar', calendarRoutes);

// 회사 홈페이지(linkbe.kr) 공개 API — 로그인 없음
app.use('/api/public/homepage', require('./routes/publicHomepage'));
app.use('/api/public/shop', require('./routes/publicShop'));

// 홈페이지 관리 API — 관리자 또는 홈페이지 권한자 (아래 /api/admin(관리자 전용)보다 먼저 연결해야 권한자가 막히지 않음)
app.use('/api/admin/homepage', require('./middlewares/requireHomepage').requireHomepage, require('./routes/adminHomepage'));
app.use('/api/admin/shop', require('./middlewares/requireHomepage').requireHomepage, require('./routes/adminShop'));

// 직원 업무 도구(경비 등) — requireAuth 뒤, 권한은 컨트롤러에서 확인
// 깨진 JSON은 /api/work에서만 400 Invalid JSON(다른 경로 동작은 그대로)
const workRoutes = require('./routes/work');
app.use('/api/work', workRoutes, workRoutes.jsonError);

// 관리자 API — requireAuth(위 /api 전체) + 관리자 권한
app.use('/api/admin', requireAdmin, require('./routes/admin'));

// /api/test 경로 추가
app.get('/api/test', (req, res) => {
    console.log('Received a request on /api/test');
    res.send('This is a test endpoint');
});

// 서버 실행
app.listen(port, () => {
    console.log(`Server running on  port ${port}`);
});
