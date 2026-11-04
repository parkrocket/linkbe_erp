const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sniffAllowed, extOf, isStoredName, ATTACHMENT_EXTS, SIGNATURES } = require('./uploads');

// 업무 첨부(거래처 접속정보 등) 저장 폴더 — 웹 루트 밖 비공개, API로만 내보냄. 파일 이름은 UUID(원본 이름은 DB에만)
// 파일 자체는 암호화하지 않음(비공개 폴더 + 권한 + 내려받기 기록)
const WORK_UPLOAD_ROOT = () => process.env.WORK_UPLOAD_ROOT || path.join(os.homedir(), 'hibye-uploads', 'work');

// 확장자 허용 목록 + 내용(매직 바이트)이 확장자와 맞는지
const isAllowedFile = file => Boolean(file && file.buffer) && ATTACHMENT_EXTS.includes(extOf(file.originalname)) && sniffAllowed(file.buffer, extOf(file.originalname));

// 검사 통과한 파일 저장 → { storedName, mime, size, originalName }
const saveWorkFile = file => {
    const storedName = crypto.randomUUID();
    fs.mkdirSync(WORK_UPLOAD_ROOT(), { recursive: true, mode: 0o700 }); // 폴더·파일은 서버 계정만 읽기
    fs.writeFileSync(path.join(WORK_UPLOAD_ROOT(), storedName), file.buffer, { mode: 0o600 });
    return { storedName, mime: SIGNATURES[extOf(file.originalname)].mime, size: file.buffer.length, originalName: String(file.originalname).slice(0, 255) };
};

// 저장 이름이 UUID 형식일 때만 지움(경로 조작 차단)
const removeWorkFile = storedName => {
    if (isStoredName(storedName)) fs.rmSync(path.join(WORK_UPLOAD_ROOT(), storedName), { force: true });
};

// Content-Disposition — 원래 이름은 RFC 5987 filename*로만(따옴표·줄바꿈 등으로 헤더를 깨지 못하게 모두 인코딩)
const attachmentHeader = name =>
    `attachment; filename*=UTF-8''${encodeURIComponent(String(name)).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`;

module.exports = { WORK_UPLOAD_ROOT, isAllowedFile, saveWorkFile, removeWorkFile, attachmentHeader, isStoredName };
