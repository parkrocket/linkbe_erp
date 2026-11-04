const sanitize = require('sanitize-html');

// 견적·계약서 양식(HTML·CSS) 정제 — 홈페이지 글 정제(sanitizeHtml.js)와 별개 규칙
// 양식은 표·여백·글꼴 같은 모양이 필요해 허용 태그·스타일이 더 넓고, 링크(a)·스크립트·폼은 허용하지 않음.
// {업체명} 같은 자리표시는 일반 글자라 그대로 남음

const STYLE_PROPS = [
    'text-align', 'vertical-align', 'font-size', 'font-weight', 'font-family', 'color', 'background-color', 'width', 'height', 'min-height',
    'line-height', 'letter-spacing', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding', 'padding-top',
    'padding-right', 'padding-bottom', 'padding-left', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-width',
    'border-style', 'border-color', 'border-collapse', 'float', 'position', 'top', 'left', 'right', 'bottom', 'display', 'page-break-before',
    'page-break-after', 'page-break-inside',
];
// 값에 외부 자원(url)·스크립트성 구문이 있으면 그 스타일은 버림
const SAFE_VALUE = /^(?!.*(url\s*\(|expression|javascript|behavior|@import|\\)).*$/i;
const allowedStyles = { '*': Object.fromEntries(STYLE_PROPS.map(p => [p, [SAFE_VALUE]])) };

const OPTIONS = {
    allowedTags: ['div', 'p', 'span', 'br', 'b', 'strong', 'i', 'u', 's', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col', 'caption', 'ul', 'ol', 'li', 'hr', 'img', 'sup', 'sub'],
    allowedAttributes: {
        '*': ['class', 'style', 'colspan', 'rowspan', 'width', 'height', 'align', 'valign'],
        img: ['src', 'alt', 'class', 'style', 'width', 'height'],
    },
    allowedStyles,
    allowedSchemes: ['https', 'data'],
    allowedSchemesByTag: { img: ['https', 'data'] },
    allowProtocolRelative: false,
    // 이미지는 https 또는 png·jpeg base64만 (svg 등 data 이미지 제외) — 아니면 통째로 제거
    exclusiveFilter: frame => frame.tag === 'img' && !/^(https:\/\/|data:image\/(png|jpeg);base64,)/i.test(frame.attribs.src || ''),
};

exports.sanitizeDocTemplate = html => sanitize(String(html ?? ''), OPTIONS);

// CSS는 정규식으로 위험 구문만 제거 — 한계: 완전한 CSS 파서가 아님.
// 신뢰하는 직원만 쓰는 화면이고, 인쇄는 스크립트가 막힌 sandbox iframe이라 이중 방어. 백슬래시(이스케이프 우회)는 모두 제거
exports.sanitizeDocCss = css => {
    let out = String(css ?? '');
    let prev;
    do {
        prev = out;
        out = out
            .replace(/\/\*[\s\S]*?\*\//g, '') // 주석 (ur/**/l( 우회 방지)
            .replace(/\\/g, '')
            .replace(/@import[^;{]*;?/gi, '')
            .replace(/url\s*\([^)]*\)?/gi, '')
            .replace(/url\s*\(/gi, '')
            .replace(/expression\s*\(/gi, '')
            .replace(/-moz-binding\s*:[^;}]*;?/gi, '')
            .replace(/behavior\s*:[^;}]*;?/gi, '')
            .replace(/javascript\s*:/gi, '')
            .replace(/</g, ''); // </style> 탈출 방지
    } while (out !== prev);
    return out;
};
