const nodemailer = require('nodemailer');

// 메일 발송 — SMTP_HOST가 없고 운영이 아니면 본문을 콘솔에만 출력(로컬 개발용)
exports.sendMail = async ({ to, subject, text }) => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST) {
        if (process.env.NODE_ENV === 'production') throw new Error('SMTP not configured');
        console.log(`[mail:dev] to=${to}\n${subject}\n${text}`);
        return;
    }
    const port = Number(SMTP_PORT);
    const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
    await transport.sendMail({ from: `"링크비" <${SMTP_USER}>`, to, subject, text });
};
