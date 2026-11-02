// 홈페이지 1:1 문의·견적 요청 검증 — 공개 양식이라 서버에서 최종 확인 (화면 검사와 같은 규칙)
const KINDS = ['qna', 'estimate'];
const CATEGORIES = ['homepage', 'design', 'blog']; // 현재 견적 양식의 제작 분류(홈페이지·디자인·블로그 디자인)
const CONTACT_METHODS = ['email', 'phone'];
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RULE = /^[0-9-]{9,13}$/;

const text = v => (typeof v === 'string' ? v.trim() : '');

exports.KINDS = KINDS;
exports.CATEGORIES = CATEGORIES;

exports.validateInquiry = (body = {}, kind) => {
    const name = text(body.name);
    const phone = text(body.phone);
    const company = text(body.company);
    const email = text(body.email);
    const content = text(body.body);
    if (!name || name.length > 30) return { error: 'Invalid name' };
    if (!PHONE_RULE.test(phone)) return { error: 'Invalid phone' };
    if (!company || company.length > 100) return { error: 'Invalid company' };
    // 1:1 문의는 이메일 필수, 견적 요청은 선택(쓰면 형식 검사)
    if ((kind === 'qna' || email) && (!EMAIL_RULE.test(email) || email.length > 150)) return { error: 'Invalid email' };
    if (!content || content.length > 5000) return { error: 'Invalid body' };
    if (body.agree !== '1' && body.agree !== true) return { error: 'Agreement required' };

    let category = null;
    let contactMethod = null;
    if (kind === 'estimate') {
        category = text(body.category);
        if (!CATEGORIES.includes(category)) return { error: 'Invalid category' };
        contactMethod = text(body.contactMethod) || null;
        if (contactMethod && !CONTACT_METHODS.includes(contactMethod)) return { error: 'Invalid contact method' };
    }
    return { value: { kind, name, phone, company, email, category, contactMethod, body: content } };
};
