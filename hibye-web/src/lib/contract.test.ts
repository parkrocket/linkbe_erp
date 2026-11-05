import { describe, expect, it } from 'vitest';
import {
    PLACEHOLDERS,
    PRINT_SANDBOX,
    buildPrintDocument,
    buildPrintValues,
    contractStatus,
    copyForNew,
    groupTemplates,
    fillTemplate,
    itemAmount,
    itemsTotal,
    pickTemplate,
    receivable,
    renderItemTable,
    vat,
    type ContractDetail,
    type ContractItem,
    type DocTemplateSummary,
} from './contract';

// 서버 scripts/checkContractCalc.js와 같은 값
describe('계산', () => {
    it('부가세', () => {
        expect(vat(0)).toBe(0);
        expect(vat(15)).toBe(1);
        expect(vat(19999)).toBe(1999);
        expect(vat(-15)).toBe(-1);
        expect(Object.is(vat(-5), 0)).toBe(true); // -0 아님
    });

    it('품목 금액·합계', () => {
        const a = { unitPrice: 100000, qty: 0, period: 0 };
        const b = { unitPrice: 50000, qty: 2, period: 3 };
        const c = { unitPrice: -30000, qty: 1, period: 0 };
        expect(itemAmount(a)).toBe(100000);
        expect(itemAmount(b)).toBe(300000);
        expect(itemAmount(c)).toBe(-30000);
        expect(itemsTotal([])).toBe(0);
        expect(itemsTotal([a, b, c])).toBe(370000);
    });

    it('미수', () => {
        expect(receivable({ total: 1000000, paidAmount: 500000 })).toBe(600000);
        expect(receivable({ total: 1000000, paidAmount: 500000, isHold: true })).toBe(0);
        expect(receivable({ total: 1000000, paidAmount: 500000, isCancelled: true })).toBe(0);
        expect(receivable({ total: 1000000, paidAmount: 1100000 })).toBe(0);
        expect(receivable({ total: 1000000, paidAmount: 1200000 })).toBe(-100000);
    });

    it('상태 우선순위', () => {
        const open = { total: 1000000, paidAmount: 500000 };
        expect(contractStatus({ ...open, isCancelled: true, isHold: true })).toBe('cancelled');
        expect(contractStatus({ ...open, isHold: true, isPaidFull: true })).toBe('hold');
        expect(contractStatus({ ...open, isPaidFull: true })).toBe('paid');
        expect(contractStatus(open)).toBe('unpaid');
        expect(contractStatus({ total: 1000000, paidAmount: 1100000 })).toBe('active');
    });
});

const item = (p: Partial<ContractItem>): ContractItem => ({
    groupName: '', content: '', unitPrice: 0, qty: 1, period: 1, note: '', kind: 'normal', ...p,
});

describe('renderItemTable', () => {
    const html = renderItemTable([
        item({ groupName: '기획', content: 'A', unitPrice: 100000 }),
        item({ groupName: '기획', content: 'B', unitPrice: 0 }),
        item({ groupName: '유지보수', content: 'C', unitPrice: 50000 }),
        item({ groupName: '할인', content: 'D', unitPrice: -10000, kind: 'discount' }),
    ]);

    it('구분 합침·합계 줄 위치', () => {
        expect(html).toContain('class="item_table"');
        expect(html).toContain('rowspan="2"');
        expect(html.indexOf('견적 합계')).toBeLessThan(html.indexOf('>C<'));
        expect(html).toContain('유지보수 합계');
        expect(html.indexOf('유지보수 합계')).toBeLessThan(html.indexOf('>D<'));
        // 유지보수 합계가 이미 나왔으므로 할인 앞에는 견적 합계가 다시 없음
        expect(html.split('견적 합계').length - 1).toBe(1);
        expect(html).toContain('총액(부가세 포함)');
    });

    it('견적 합계 값은 그 앞까지의 합', () => {
        expect(html).toMatch(/견적 합계<\/td><td class="right">100,000<\/td>/);
        expect(html).toMatch(/유지보수 합계<\/td><td class="right">50,000<\/td>/);
    });

    it('할인만 있고 유지보수 없으면 할인 앞에 견적 합계', () => {
        const h = renderItemTable([item({ groupName: '기획', unitPrice: 1000 }), item({ groupName: '할인', unitPrice: -100 })]);
        expect(h.indexOf('견적 합계')).toBeGreaterThan(-1);
        expect(h.indexOf('견적 합계')).toBeLessThan(h.indexOf('할인</td>'));
        expect(h).not.toContain('유지보수 합계');
    });

    it('0은 -, 음수 금액은 red, 이스케이프', () => {
        expect(html).toContain('<td class="right">-</td>');
        expect(html).toContain('<td class="right red">-10,000</td>');
        const x = renderItemTable([item({ content: '<b>굵게</b>', note: '<i>' })]);
        expect(x).toContain('&lt;b&gt;');
        expect(x).not.toContain('<b>');
    });

    it('품목 0개도 합계 0 줄', () => {
        const h = renderItemTable([]);
        expect(h).toContain('합계');
        expect(h).not.toContain('견적 합계');
    });
});

describe('fillTemplate', () => {
    it('값은 이스케이프·줄바꿈, 품목표는 그대로, 모르는 자리표시는 유지', () => {
        expect(fillTemplate('<p>{업체명} {품목표} {모름}</p>', { 업체명: '<가>\n나' }, '<table></table>')).toBe(
            '<p>&lt;가&gt;<br>나 <table></table> {모름}</p>',
        );
    });
});

const detail = (p: Partial<ContractDetail> = {}): ContractDetail => ({
    id: 1, docNo: '20261105-1000', categoryId: 1, categoryName: '웹', companyName: '테스트업체', bizNo: '', ceoName: '홍길동',
    companyEmail: '', projectName: '', contractDate: '2026-11-05', deliveryDate: null, workPeriod: '', memo: '', link1: '', link2: '',
    total: 1000000, deposit: 500000, balance: 500000, paidAmount: 0, isHold: false, isCancelled: false, isPaidFull: false,
    invoiceIssued: false, opsServer1: '', opsServer2: '', opsSpend: '', opsSite: '', createdAt: '2026-11-04 09:00:00',
    updatedAt: '2026-11-04 09:00:00', updatedAtKst: '2026-11-04 09:00:00', items: [], managers: [], ...p,
});

describe('buildPrintValues', () => {
    it('금액·날짜 형식', () => {
        const v = buildPrintValues(detail(), '2026-11-06');
        expect(v['총액']).toBe('1,100,000');
        expect(v['부가세']).toBe('100,000');
        expect(v['계약금총액']).toBe('550,000');
        expect(v['계약일']).toBe('2026.11.05');
        expect(v['작성일']).toBe('2026.11.04');
        expect(v['오늘']).toBe('2026.11.06');
        expect(v['미수']).toBe('1,100,000');
    });

    it('날짜 없음·담당자 없음은 빈 문자열', () => {
        const v = buildPrintValues(detail({ contractDate: null }), '2026-11-06');
        expect(v['계약일']).toBe('');
        expect(v['납품일']).toBe('');
        expect(v['담당자']).toBe('');
        const w = buildPrintValues(detail({ managers: [{ name: '김철수', phone: '010', email: 'a@b.c', memo: '' }] }), '2026-11-06');
        expect(w['담당자']).toBe('김철수');
        expect(w['담당자전화']).toBe('010');
    });

    it('PLACEHOLDERS 전부(품목표 제외)가 값에 있음', () => {
        const v = buildPrintValues(detail(), '2026-11-06');
        for (const p of PLACEHOLDERS) if (p.key !== '품목표') expect(v).toHaveProperty(p.key);
        expect(PLACEHOLDERS.some(p => p.key === '품목표')).toBe(true);
    });
});

describe('pickTemplate', () => {
    const t = (id: number, kind: 'estimate' | 'contract', categoryId: number | null, isDefault: boolean): DocTemplateSummary => ({
        id, kind, name: `양식${id}`, groupName: null, categoryId, isDefault, updatedAt: '',
    });
    it('분류 기본 → 공통 기본 → 첫 양식 → null', () => {
        const all = [t(5, 'estimate', null, true), t(3, 'estimate', 7, true), t(2, 'estimate', 7, false), t(9, 'contract', 7, true)];
        expect(pickTemplate(all, 'estimate', 7)?.id).toBe(3);
        expect(pickTemplate(all, 'estimate', 8)?.id).toBe(5);
        expect(pickTemplate(all, 'estimate', null)?.id).toBe(5);
        expect(pickTemplate([t(4, 'estimate', 7, false), t(2, 'estimate', 8, false)], 'estimate', 9)?.id).toBe(2);
        expect(pickTemplate(all, 'contract', 1)?.id).toBe(9);
        expect(pickTemplate([t(1, 'estimate', null, true)], 'contract', 1)).toBeNull();
        expect(pickTemplate([], 'estimate', null)).toBeNull();
    });
});

describe('buildPrintDocument', () => {
    it('스크립트·외부 자원 차단', () => {
        const doc = buildPrintDocument('a{}</style><script>x()</script>', '<p>본문</p>', '제목</title><script>');
        expect(doc).not.toContain('</style><script');
        expect(doc).not.toContain('<script');
        expect(doc).toContain(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">`);
        expect(doc.startsWith('<!doctype html><html><head><meta charset="utf-8">')).toBe(true);
        expect(doc).toContain('@page{size:A4;margin:10mm}');
        expect(doc).toContain('<p>본문</p></body></html>');
    });

    it('인쇄 iframe sandbox에 allow-scripts 없음', () => {
        expect(PRINT_SANDBOX).not.toContain('allow-scripts');
    });
});

describe('화면 입력 도우미', () => {
    it('금액 입력은 숫자와 앞의 -만, 콤마 표시', async () => {
        const { formatMoneyInput, parseMoney } = await import('./contract');
        expect(formatMoneyInput('1234567')).toBe('1,234,567');
        expect(formatMoneyInput('-1234')).toBe('-1,234');
        expect(formatMoneyInput('-')).toBe('-');
        expect(formatMoneyInput('12-3a4')).toBe('1,234');
        expect(formatMoneyInput('')).toBe('');
        expect(formatMoneyInput('9'.repeat(400))).toBe('9,999,999,999');
        expect(formatMoneyInput('-' + '9'.repeat(400))).toBe('-9,999,999,999');
        expect(parseMoney(formatMoneyInput('9'.repeat(400)))).toBe(9999999999);
        expect(parseMoney('-1,234')).toBe(-1234);
        expect(parseMoney('-')).toBe(0);
        expect(parseMoney('')).toBe(0);
    });
    it('납품일 D-day', async () => {
        const { deliveryDday } = await import('./contract');
        const r = (deliveryDate: string | null, status: 'active' | 'paid' = 'active') => ({ deliveryDate, status });
        expect(deliveryDday(r('2026-11-07'), '2026-11-04')).toBe('D-3');
        expect(deliveryDday(r('2026-11-04'), '2026-11-04')).toBe('D-day');
        expect(deliveryDday(r('2026-11-03'), '2026-11-04')).toBe('지남');
        expect(deliveryDday(r(null), '2026-11-04')).toBe('');
        expect(deliveryDday(r('2026-11-07', 'paid'), '2026-11-04')).toBe('');
    });
});

describe('copyForNew', () => {
    it('업체·품목·담당자·금액은 그대로, 번호·날짜·입금·상태는 비움', () => {
        const c = { id: 7, docNo: 'L-1', contractDate: '2026-01-02', deliveryDate: '2026-02-03', paidAmount: 500, isHold: true, isCancelled: true, isPaidFull: true, invoiceIssued: true, companyName: '가', total: 1000, items: [{ content: 'x' }], managers: [{ name: '나' }] } as unknown as ContractDetail;
        const n = copyForNew(c);
        expect([n.docNo, n.contractDate, n.deliveryDate, n.paidAmount, n.isHold, n.isCancelled, n.isPaidFull, n.invoiceIssued]).toEqual(['', null, null, 0, false, false, false, false]);
        expect([n.companyName, n.total, n.items, n.managers]).toEqual(['가', 1000, c.items, c.managers]);
        expect(c.docNo).toBe('L-1');
    });
});

describe('groupTemplates', () => {
    it('그룹별로 묶음 — 기본(그룹 없음)이 맨 앞, 나머지는 한국어 정렬, 그룹 안은 원래 순서', () => {
        const t = (id: number, groupName: string | null) => ({ id, kind: 'contract' as const, name: `t${id}`, groupName, categoryId: null, isDefault: false, updatedAt: '' });
        const groups = groupTemplates([t(1, '로엘'), t(2, null), t(3, 'YK'), t(4, '도담'), t(5, '로엘'), t(6, null)]);
        expect(groups.map(g => g.group)).toEqual(['기본', '도담', '로엘', 'YK']); // 한국어 정렬: 한글 먼저
        expect(groups[0].items.map(i => i.id)).toEqual([2, 6]);
        expect(groups[2].items.map(i => i.id)).toEqual([1, 5]);
        expect(groupTemplates([])).toEqual([]);
    });
});
