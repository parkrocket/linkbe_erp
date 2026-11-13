const express = require('express');
const multer = require('multer');
const work = require('../controllers/workExpenseController');
const contract = require('../controllers/workContractController');
const docSetting = require('../controllers/workDocSettingController');
const ledger = require('../controllers/workLedgerController');
const siteContract = require('../controllers/workSiteContractController');
const client = require('../controllers/workClientController');
const board = require('../controllers/workBoardController');
const { requireWorkDoc } = require('../middlewares/requireWorkDoc');
const { requireClientSecret } = require('../middlewares/requireClientSecret');
const { requireAdmin } = require('../middlewares/requireAdmin');
const router = express.Router();

// /api/work/* — index.js에서 requireAuth(/api 전체) 뒤에 연결. 경비 권한은 컨트롤러에서 확인
router.get('/summary', work.summary);
router.get('/expenses', work.list);
router.post('/expenses', work.create);
router.get('/expenses/:id', work.detail);
router.post('/expenses/:id', work.update);
router.delete('/expenses/:id', work.remove);
router.post('/expenses/:id/status', work.changeStatus);

// 견적·계약서·양식 설정 — 업무 문서 권한자만(경비와 별개)
router.use(['/contracts', '/doc-settings', '/ledger', '/accounts', '/boards', '/site-contracts'], requireWorkDoc);

// 계약 관리(업체별 홈페이지 계약 기간)
router.get('/site-contracts', siteContract.list);
router.post('/site-contracts', siteContract.create);
router.post('/site-contracts/:id', siteContract.update);
router.delete('/site-contracts/:id', siteContract.remove);

router.get('/contracts', contract.list);
router.get('/contracts/companies', contract.companies); // :id보다 먼저
router.post('/contracts', contract.create);
router.get('/contracts/:id', contract.detail);
router.post('/contracts/:id', contract.update);
router.delete('/contracts/:id', contract.remove);

// 매출/매입 장부·계정과목
router.get('/ledger', ledger.list);
router.post('/ledger', ledger.create);
router.get('/ledger/:id', ledger.detail);
router.post('/ledger/:id', ledger.update);
router.delete('/ledger/:id', ledger.remove);
router.get('/accounts', ledger.accounts);
router.post('/accounts', requireAdmin, ledger.createAccount);
router.post('/accounts/:id', requireAdmin, ledger.updateAccount);
router.delete('/accounts/:id', requireAdmin, ledger.removeAccount);

// 바이럴 게시판(게시판 이름 viral 고정)
router.get('/boards/viral', board.list);
router.post('/boards/viral', board.create);
router.get('/boards/viral/:id', board.detail);
router.post('/boards/viral/:id', board.update);
router.delete('/boards/viral/:id', board.remove);
router.post('/boards/viral/:id/comments', board.createComment);
router.delete('/boards/viral/:id/comments/:cid', board.removeComment);

// 설정 쓰기(분류·품목 문구·양식·계정과목)는 관리자만(11-05 — 설정 화면이 관리자 페이지로 옮겨감). 읽기는 업무 문서 권한자(견적 작성·장부가 씀)
router.get('/doc-settings', docSetting.overview);
router.post('/doc-settings/categories', requireAdmin, docSetting.createCategory);
router.post('/doc-settings/categories/:id', requireAdmin, docSetting.renameCategory);
router.post('/doc-settings/categories/:id/move', requireAdmin, docSetting.moveCategory);
router.delete('/doc-settings/categories/:id', requireAdmin, docSetting.removeCategory);
router.get('/doc-settings/item-templates', docSetting.itemTemplates);
router.post('/doc-settings/item-templates', requireAdmin, docSetting.createItemTemplate);
router.post('/doc-settings/item-templates/:id', requireAdmin, docSetting.updateItemTemplate);
router.post('/doc-settings/item-templates/:id/move', requireAdmin, docSetting.moveItemTemplate);
router.delete('/doc-settings/item-templates/:id', requireAdmin, docSetting.removeItemTemplate);
router.post('/doc-settings/doc-templates', requireAdmin, docSetting.createDocTemplate);
router.get('/doc-settings/doc-templates/:id', docSetting.docTemplateDetail);
router.post('/doc-settings/doc-templates/:id', requireAdmin, docSetting.updateDocTemplate);
router.delete('/doc-settings/doc-templates/:id', requireAdmin, docSetting.removeDocTemplate);

// 거래처 접속정보 — 접속정보 권한자만(업무 문서 권한과 별개). 권한 확인이 첨부 받기(multer)보다 먼저
router.use('/clients', requireClientSecret);
// defParamCharset: 한글 파일 이름을 UTF-8로 읽음(기본 latin1이면 깨짐)
const upload = multer({ storage: multer.memoryStorage(), defParamCharset: 'utf8', limits: { fileSize: 50 * 1024 * 1024, files: 1 } });
const oneFile = (req, res, next) =>
    upload.single('file')(req, res, error => {
        if (!error) return next();
        if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large' });
        res.status(400).json({ error: 'Invalid file' });
    });

router.get('/clients', client.list);
router.post('/clients', client.create);
router.get('/clients/:id', client.detail);
router.post('/clients/:id', client.update);
router.delete('/clients/:id', client.remove);
router.post('/clients/:id/memo', client.updateMemo);
router.post('/clients/:id/star', client.setStar);
router.post('/clients/:id/credentials', client.createCredential);
router.post('/clients/:id/credentials/:cid', client.updateCredential);
router.delete('/clients/:id/credentials/:cid', client.removeCredential);
router.post('/clients/:id/credentials/:cid/reveal', client.revealCredential);
router.post('/clients/:id/legacy-memo/reveal', client.revealLegacy);
router.post('/clients/:id/files', oneFile, client.uploadFile);
router.get('/clients/:id/files/:fid', client.downloadFile);
router.delete('/clients/:id/files/:fid', client.removeFile);

// 깨진 JSON 본문(앞단 express.json 오류) → 400. 기본 처리기는 오류 내용(본문 일부)을 기록·응답하므로 /api/work에서는 아무것도 출력하지 않음
// 앞단 오류는 라우터 안으로 들어오지 않아 index.js에서 app.use('/api/work', router, router.jsonError)로 붙임
// eslint-disable-next-line no-unused-vars
router.jsonError = (err, req, res, next) => (err && err.type === 'entity.parse.failed' ? res.status(400).json({ error: 'Invalid JSON' }) : next(err));

module.exports = router;
