const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

// 홈페이지 업로드 저장 폴더 — public(공지·포트폴리오·팝업 이미지) / private(문의 첨부, 관리자만)
// 웹 루트 밖에 두고 API로만 내보냄. 파일 이름은 UUID(원본 이름·확장자는 DB에만)
const UPLOAD_ROOT = () => process.env.UPLOAD_ROOT || path.join(os.homedir(), 'hibye-uploads', 'homepage');
const uploadDir = visibility => path.join(UPLOAD_ROOT(), visibility === 'public' ? 'public' : 'private');

// 저장 이름 형식 검사 — 경로 조작(../) 차단
const isStoredName = name => typeof name === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(name);

const publicFileUrl = id => (id ? `/node/api/public/homepage/files/${id}` : null);

// 허용 확장자 → MIME, 파일 앞부분(매직 바이트) — 확장자만 바꾼 실행 파일 등을 거절
const ZIP = '504b0304'; // 새 오피스·한글(hwpx)은 zip 형식
const OLE = 'd0cf11e0'; // 옛 오피스·한글(hwp)은 OLE 형식
const SIGNATURES = {
    pdf: { mime: 'application/pdf', magic: '25504446' }, // %PDF
    png: { mime: 'image/png', magic: '89504e47' },
    jpg: { mime: 'image/jpeg', magic: 'ffd8ff' },
    jpeg: { mime: 'image/jpeg', magic: 'ffd8ff' },
    gif: { mime: 'image/gif', magic: '47494638' },
    webp: { mime: 'image/webp', magic: '52494646' }, // RIFF
    zip: { mime: 'application/zip', magic: ZIP },
    docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: ZIP },
    xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: ZIP },
    pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', magic: ZIP },
    hwpx: { mime: 'application/hwp+zip', magic: ZIP },
    doc: { mime: 'application/msword', magic: OLE },
    xls: { mime: 'application/vnd.ms-excel', magic: OLE },
    ppt: { mime: 'application/vnd.ms-powerpoint', magic: OLE },
    hwp: { mime: 'application/x-hwp', magic: OLE },
};
const ATTACHMENT_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

const extOf = name => path.extname(String(name || '')).slice(1).toLowerCase();

const sniffAllowed = (buffer, ext) => {
    const sig = SIGNATURES[ext];
    if (!sig || !buffer || buffer.length < 3) return false;
    return buffer.subarray(0, 8).toString('hex').startsWith(sig.magic);
};

// 검사 통과한 파일을 저장 — { storedName, mime, size, originalName }
const saveUpload = (file, visibility) => {
    const storedName = crypto.randomUUID();
    fs.mkdirSync(uploadDir(visibility), { recursive: true });
    fs.writeFileSync(path.join(uploadDir(visibility), storedName), file.buffer);
    return { storedName, mime: SIGNATURES[extOf(file.originalname)].mime, size: file.size, originalName: String(file.originalname).slice(0, 255) };
};

const removeUpload = (storedName, visibility) => {
    if (isStoredName(storedName)) fs.rmSync(path.join(uploadDir(visibility), storedName), { force: true });
};

module.exports = { UPLOAD_ROOT, uploadDir, isStoredName, publicFileUrl, sniffAllowed, saveUpload, removeUpload, extOf, ATTACHMENT_EXTS, IMAGE_EXTS, SIGNATURES };
