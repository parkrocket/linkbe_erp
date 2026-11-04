const express = require('express');
const work = require('../controllers/workExpenseController');
const contract = require('../controllers/workContractController');
const docSetting = require('../controllers/workDocSettingController');
const ledger = require('../controllers/workLedgerController');
const { requireWorkDoc } = require('../middlewares/requireWorkDoc');
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
router.use(['/contracts', '/doc-settings', '/ledger', '/accounts'], requireWorkDoc);

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
router.post('/accounts', ledger.createAccount);
router.post('/accounts/:id', ledger.updateAccount);
router.delete('/accounts/:id', ledger.removeAccount);

router.get('/doc-settings', docSetting.overview);
router.post('/doc-settings/categories', docSetting.createCategory);
router.post('/doc-settings/categories/:id', docSetting.renameCategory);
router.post('/doc-settings/categories/:id/move', docSetting.moveCategory);
router.delete('/doc-settings/categories/:id', docSetting.removeCategory);
router.get('/doc-settings/item-templates', docSetting.itemTemplates);
router.post('/doc-settings/item-templates', docSetting.createItemTemplate);
router.post('/doc-settings/item-templates/:id', docSetting.updateItemTemplate);
router.post('/doc-settings/item-templates/:id/move', docSetting.moveItemTemplate);
router.delete('/doc-settings/item-templates/:id', docSetting.removeItemTemplate);
router.post('/doc-settings/doc-templates', docSetting.createDocTemplate);
router.get('/doc-settings/doc-templates/:id', docSetting.docTemplateDetail);
router.post('/doc-settings/doc-templates/:id', docSetting.updateDocTemplate);
router.delete('/doc-settings/doc-templates/:id', docSetting.removeDocTemplate);

module.exports = router;
