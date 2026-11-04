// 견적·계약서 화면 공용 규칙 — 계산은 서버 nodejs-server/src/utils/contractCalc.js와 같은 규칙·같은 테스트 값
// (API 응답 칸 이름은 서버 workContractController·workDocSettingController 그대로)

export const CONTRACT_STATUS_LABEL = {
    active: '진행',
    unpaid: '미수 있음',
    paid: '완납',
    hold: '보류',
    cancelled: '취소',
} as const;
export type ContractStatus = keyof typeof CONTRACT_STATUS_LABEL;

export type DocKind = 'estimate' | 'contract';
export type ItemKind = 'normal' | 'discount';

export type ContractRow = {
    id: number;
    docNo: string;
    categoryId: number | null;
    categoryName: string | null;
    companyName: string;
    projectName: string;
    contractDate: string | null;
    deliveryDate: string | null;
    total: number;
    paidAmount: number;
    receivable: number;
    status: ContractStatus;
    invoiceIssued: boolean;
    createdAt: string;
};

export type ContractItem = {
    id?: number;
    sort?: number;
    groupName: string;
    content: string;
    unitPrice: number;
    qty: number;
    period: number;
    note: string;
    kind: ItemKind;
};

export type ContractManager = { id?: number; sort?: number; name: string; phone: string; email: string; memo: string };

export type ContractDetail = {
    id: number;
    docNo: string;
    categoryId: number | null;
    categoryName: string | null;
    companyName: string;
    bizNo: string;
    ceoName: string;
    companyEmail: string;
    projectName: string;
    contractDate: string | null;
    deliveryDate: string | null;
    workPeriod: string;
    memo: string;
    link1: string;
    link2: string;
    total: number;
    deposit: number;
    balance: number;
    paidAmount: number;
    isHold: boolean;
    isCancelled: boolean;
    isPaidFull: boolean;
    invoiceIssued: boolean;
    opsServer1: string;
    opsServer2: string;
    opsSpend: string;
    opsSite: string;
    createdAt: string;
    updatedAt: string; // 동시 수정 검사용(저장 때 그대로 되돌려 보냄)
    items: ContractItem[];
    managers: ContractManager[];
};

export type Category = { id: number; name: string; sort: number; used: number };
export type ItemTemplate = {
    id: number;
    categoryId: number;
    groupName: string;
    content: string;
    unitPrice: number;
    qty: number;
    period: number;
    note: string;
    kind: ItemKind;
    sort: number;
};
export type DocTemplateSummary = { id: number; kind: DocKind; name: string; categoryId: number | null; isDefault: boolean; updatedAt: string };
export type DocTemplate = DocTemplateSummary & { bodyHtml: string; css: string };

// ---- 계산 (서버와 같은 값) ----
// 부가세: 0 쪽으로 내림, 음수는 -vat(-n). `|| 0`은 -0을 0으로
export const vat = (n: number): number => (n >= 0 ? Math.floor(n * 0.1) : -Math.floor(-n * 0.1) || 0);

// 품목 금액: 수량·기간 0은 1로 셈(예전 규칙)
export const itemAmount = ({ unitPrice, qty, period }: Pick<ContractItem, 'unitPrice' | 'qty' | 'period'>): number =>
    unitPrice * (qty || 1) * (period || 1);

export const itemsTotal = (items: Pick<ContractItem, 'unitPrice' | 'qty' | 'period'>[]): number =>
    items.reduce((sum, item) => sum + itemAmount(item), 0);

// 미수: 보류·취소는 0, 초과 입금은 음수(0 미만으로 자르지 않음)
export const receivable = (c: { total: number; paidAmount: number; isHold?: boolean; isCancelled?: boolean }): number =>
    c.isHold || c.isCancelled ? 0 : c.total + vat(c.total) - c.paidAmount;

// 상태 우선순위: 취소 → 보류 → 완납 → 미수 → 진행
export function contractStatus(c: {
    total: number;
    paidAmount: number;
    isHold?: boolean;
    isCancelled?: boolean;
    isPaidFull?: boolean;
}): ContractStatus {
    if (c.isCancelled) return 'cancelled';
    if (c.isHold) return 'hold';
    if (c.isPaidFull) return 'paid';
    return receivable(c) > 0 ? 'unpaid' : 'active';
}

// ---- 자리표시 ----
export const PLACEHOLDERS: { key: string; label: string }[] = [
    { key: '문서번호', label: '문서번호' },
    { key: '분류', label: '분류' },
    { key: '업체명', label: '업체명' },
    { key: '사업자번호', label: '사업자번호' },
    { key: '대표자', label: '대표자' },
    { key: '업체이메일', label: '업체 이메일' },
    { key: '프로젝트명', label: '프로젝트명' },
    { key: '계약일', label: '계약일' },
    { key: '납품일', label: '납품일' },
    { key: '작업기간', label: '작업기간' },
    { key: '작성일', label: '작성일' },
    { key: '오늘', label: '오늘 날짜' },
    { key: '합계', label: '합계(부가세 제외)' },
    { key: '부가세', label: '부가세' },
    { key: '총액', label: '총액(부가세 포함)' },
    { key: '계약금', label: '계약금' },
    { key: '계약금부가세', label: '계약금 부가세' },
    { key: '계약금총액', label: '계약금 총액' },
    { key: '완료금', label: '완료금' },
    { key: '완료금부가세', label: '완료금 부가세' },
    { key: '완료금총액', label: '완료금 총액' },
    { key: '입금액', label: '입금액' },
    { key: '미수', label: '미수' },
    { key: '품목합계', label: '품목 합계' },
    { key: '품목부가세', label: '품목 부가세' },
    { key: '품목총액', label: '품목 총액' },
    { key: '담당자', label: '담당자(첫 번째)' },
    { key: '담당자전화', label: '담당자 전화' },
    { key: '담당자이메일', label: '담당자 이메일' },
    { key: '메모', label: '메모' },
    { key: '운영서버1', label: '운영서버1' },
    { key: '운영서버2', label: '운영서버2' },
    { key: '운영비용', label: '운영비용' },
    { key: '운영사이트', label: '운영사이트' },
    { key: '품목표', label: '품목표(표)' },
];

// 금액: 천 단위 콤마 (원 표기 없음)
const won = (n: number) => Number(n).toLocaleString('ko-KR');

// 'YYYY-MM-DD'(뒤에 시각이 붙어도 앞 10자) → 'YYYY.MM.DD', 아니면 ''
const dotDate = (v: string | null | undefined): string => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
    return m ? `${m[1]}.${m[2]}.${m[3]}` : '';
};

// {품목표}를 뺀 모든 자리표시 값 (이스케이프 전 문자열)
export function buildPrintValues(c: ContractDetail, today: string): Record<string, string> {
    const sumItems = itemsTotal(c.items);
    const m = c.managers[0];
    return {
        문서번호: c.docNo,
        분류: c.categoryName || '',
        업체명: c.companyName,
        사업자번호: c.bizNo,
        대표자: c.ceoName,
        업체이메일: c.companyEmail,
        프로젝트명: c.projectName,
        계약일: dotDate(c.contractDate),
        납품일: dotDate(c.deliveryDate),
        작업기간: c.workPeriod,
        작성일: dotDate(c.createdAt),
        오늘: dotDate(today),
        합계: won(c.total),
        부가세: won(vat(c.total)),
        총액: won(c.total + vat(c.total)),
        계약금: won(c.deposit),
        계약금부가세: won(vat(c.deposit)),
        계약금총액: won(c.deposit + vat(c.deposit)),
        완료금: won(c.balance),
        완료금부가세: won(vat(c.balance)),
        완료금총액: won(c.balance + vat(c.balance)),
        입금액: won(c.paidAmount),
        미수: won(receivable(c)),
        품목합계: won(sumItems),
        품목부가세: won(vat(sumItems)),
        품목총액: won(sumItems + vat(sumItems)),
        담당자: m ? m.name : '',
        담당자전화: m ? m.phone : '',
        담당자이메일: m ? m.email : '',
        메모: c.memo,
        운영서버1: c.opsServer1,
        운영서버2: c.opsServer2,
        운영비용: c.opsSpend,
        운영사이트: c.opsSite,
    };
}

// HTML 이스케이프 (이 파일 하나만 사용)
const escapeHtml = (s: string) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// 0은 '-', 음수는 빨강
const moneyCell = (n: number, extra = '') =>
    `<td class="right${n < 0 ? ' red' : ''}"${extra}>${n === 0 ? '-' : won(n)}</td>`;
const countCell = (n: number) => `<td class="right">${n === 0 ? '-' : won(n)}</td>`;

// {품목표}: 예전 견적서 표와 같은 모양
export function renderItemTable(items: ContractItem[]): string {
    const rows: string[] = [];
    // 5칸(구분·내용·단가·수량·기간)을 합친 줄
    const sumRow = (label: string, amount: number) =>
        `<tr class="sum"><td colspan="5" class="center">${escapeHtml(label)}</td>${moneyCell(amount)}<td></td></tr>`;

    let running = 0; // 지금까지 합
    let maintSum = 0;
    let inMaint = false;
    let maintDone = false; // 유지보수 합계 줄이 이미 나왔는지
    let discountStarted = false;

    items.forEach((it, i) => {
        const isMaint = it.groupName === '유지보수';
        if (inMaint && !isMaint) {
            rows.push(sumRow('유지보수 합계', maintSum));
            inMaint = false;
            maintDone = true;
        }
        if (isMaint && !inMaint && !maintDone) {
            rows.push(sumRow('견적 합계', running));
            inMaint = true;
        }
        if (it.groupName === '할인' && !discountStarted) {
            discountStarted = true;
            if (!maintDone) rows.push(sumRow('견적 합계', running));
        }
        const amount = itemAmount(it);
        running += amount;
        if (inMaint) maintSum += amount;

        // 같은 구분이 이어지면 첫 줄에만 구분 칸(rowspan)
        const prev = items[i - 1];
        const merged = it.groupName !== '' && prev && prev.groupName === it.groupName;
        let groupCell = '';
        if (!merged) {
            let span = 1;
            while (it.groupName !== '' && items[i + span] && items[i + span].groupName === it.groupName) span++;
            groupCell = `<td class="center"${span > 1 ? ` rowspan="${span}"` : ''}>${escapeHtml(it.groupName)}</td>`;
        }
        rows.push(
            `<tr>${groupCell}<td>${escapeHtml(it.content).replace(/\n/g, '<br>')}</td>${moneyCell(it.unitPrice)}${countCell(it.qty)}${countCell(it.period)}${moneyCell(amount)}<td>${escapeHtml(it.note).replace(/\n/g, '<br>')}</td></tr>`,
        );
    });
    if (inMaint) rows.push(sumRow('유지보수 합계', maintSum));

    const total = running;
    rows.push(sumRow('합계', total), sumRow('부가세', vat(total)), sumRow('총액(부가세 포함)', total + vat(total)));
    return (
        '<table class="item_table"><thead><tr><th>구분</th><th>내용</th><th>단가</th><th>수량</th><th>기간</th><th>금액</th><th>비고</th></tr></thead><tbody>' +
        rows.join('') +
        '</tbody></table>'
    );
}

// 양식 본문의 {이름}을 값으로 — 값은 이스케이프 + 줄바꿈 <br>, {품목표}만 HTML 그대로, 모르는 {…}는 그대로
export function fillTemplate(bodyHtml: string, values: Record<string, string>, itemTableHtml: string): string {
    return bodyHtml.replace(/\{([^{}]+)\}/g, (whole, key: string) => {
        if (key === '품목표') return itemTableHtml;
        return Object.prototype.hasOwnProperty.call(values, key) ? escapeHtml(values[key]).replace(/\r?\n/g, '<br>') : whole;
    });
}

// 양식 고르기: 분류 기본 → 공통(분류 없음) 기본 → 그 종류 첫 양식(id 순) → null
export function pickTemplate(templates: DocTemplateSummary[], kind: DocKind, categoryId: number | null): DocTemplateSummary | null {
    const list = templates.filter(t => t.kind === kind).sort((a, b) => a.id - b.id);
    return (
        (categoryId != null ? list.find(t => t.isDefault && t.categoryId === categoryId) : undefined) ||
        list.find(t => t.isDefault && t.categoryId == null) ||
        list[0] ||
        null
    );
}

// 인쇄 iframe의 sandbox — 스크립트 실행 불가(allow-scripts 없음)
export const PRINT_SANDBOX = 'allow-same-origin allow-modals';

// 인쇄용 문서 — 외부 자원 차단 meta, css·title 안의 닫는 태그 무력화
export function buildPrintDocument(css: string, body: string, title: string): string {
    const safeCss = css.replace(/<\/?(style|script)/gi, '');
    const safeTitle = escapeHtml(title).replace(/<\/title/gi, '');
    return (
        '<!doctype html><html><head><meta charset="utf-8">' +
        `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">` +
        `<title>${safeTitle}</title><style>@page{size:A4;margin:10mm}${safeCss}</style></head><body>${body}</body></html>`
    );
}

// ---- 화면 입력 도우미 ----
// 금액 입력: 숫자와 맨 앞 '-'만 남기고 천 단위 콤마 (음수 허용)
export function formatMoneyInput(v: string): string {
    const neg = v.trimStart().startsWith('-');
    // 숫자는 10자리까지 (아주 긴 붙여넣기가 Infinity가 되지 않게, 범위 검사는 저장 때)
    const digits = v.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
    if (!digits) return neg ? '-' : '';
    return (neg ? '-' : '') + Number(digits).toLocaleString('ko-KR');
}

// 입력 문자열 → 정수 ('' · '-'는 0)
export const parseMoney = (v: string): number => Number(v.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '')) || 0;

// 납품일까지 남은 날: 오늘 기준 'D-3'·'D-day'·'지남', 납품일 없거나 완납·취소면 ''
export function deliveryDday(row: Pick<ContractRow, 'deliveryDate' | 'status'>, today: string): string {
    if (!row.deliveryDate || row.status === 'paid' || row.status === 'cancelled') return '';
    const days = Math.round((Date.parse(row.deliveryDate) - Date.parse(today)) / 86400000);
    return days < 0 ? '지남' : days === 0 ? 'D-day' : `D-${days}`;
}
