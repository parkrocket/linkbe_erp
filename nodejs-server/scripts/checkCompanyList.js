// 회사 목록(공개 API) 점검: node scripts/checkCompanyList.js
// 로그인 없이 호출되므로 회원가입에 필요한 번호·이름만 내려야 함 (사무실 IP·사업자번호·회사코드 노출 금지)
const assert = require('assert');
const db = require('../src/config/db');

db.query = (sql, cb) => {
    // 가짜 DB: 실제 행처럼 모든 컬럼이 있다고 가정
    cb(null, [{ cp_id: 1, cp_name: '링크비', cp_ip: '1.2.3.4', cp_regi_number: '000', cp_code: 'secret', cp_addr: 'addr' }]);
};

const controller = require('../src/controllers/companyController');
let body;
controller.list({}, { json: b => (body = b), status: () => ({ json: b => (body = b) }) });

assert.deepStrictEqual(body.list, [{ cp_id: 1, cp_name: '링크비' }], '번호·이름 외 필드 노출');
console.log('checkCompanyList ✅');
process.exit(0);
