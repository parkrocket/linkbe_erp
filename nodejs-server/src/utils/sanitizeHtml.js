const sanitize = require('sanitize-html');

// 관리자가 쓴 글(공지·포트폴리오·FAQ·안내 페이지)을 저장하기 전 정제 — 허용 목록 외 태그·속성·주소 제거(XSS 방지)
// 이미지는 우리 공개 파일 주소 또는 https만, 링크는 http(s)·mailto·tel만, 새 창 링크는 rel 강제
const OPTIONS = {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span'],
    allowedAttributes: {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt', 'width', 'height'],
        span: ['style'],
        p: ['style'],
    },
    allowedStyles: {
        '*': { color: [/^#[0-9a-f]{3,6}$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/, /^[a-z]+$/i], 'text-align': [/^(left|right|center|justify)$/] },
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    transformTags: { a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } }) },
    // 허용 안 된 주소의 이미지는 통째로 제거 (빈 img 남기지 않음)
    exclusiveFilter: frame => frame.tag === 'img' && !/^(\/node\/api\/public\/homepage\/files\/\d+|https:\/\/)/.test(frame.attribs.src || ''),
};

exports.sanitizeHtml = html => sanitize(String(html ?? ''), OPTIONS);
