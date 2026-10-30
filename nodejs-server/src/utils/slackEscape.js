// Slack 메시지에 사용자 입력(이름 등)을 넣을 때 & < > 이스케이프 — Slack 공식 권장
// 이스케이프하지 않으면 공개 회원가입 이름으로 <!channel> 멘션이나 <링크|문구> 피싱 링크를 봇 메시지에 넣을 수 있음
const escapeSlack = text => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = { escapeSlack };
