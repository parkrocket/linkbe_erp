const os = require('os');
const path = require('path');

// 홈페이지 업로드 저장 폴더 — public(공지·포트폴리오·팝업 이미지) / private(문의 첨부, 관리자만)
// 웹 루트 밖에 두고 API로만 내보냄. 파일 이름은 UUID(원본 이름·확장자는 DB에만)
const UPLOAD_ROOT = () => process.env.UPLOAD_ROOT || path.join(os.homedir(), 'hibye-uploads', 'homepage');
const uploadDir = visibility => path.join(UPLOAD_ROOT(), visibility === 'public' ? 'public' : 'private');

// 저장 이름 형식 검사 — 경로 조작(../) 차단
const isStoredName = name => typeof name === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(name);

const publicFileUrl = id => (id ? `/node/api/public/homepage/files/${id}` : null);

module.exports = { UPLOAD_ROOT, uploadDir, isStoredName, publicFileUrl };
