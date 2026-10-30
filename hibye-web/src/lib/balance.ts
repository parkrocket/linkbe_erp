// 관리자 연차·휴가 조정 — 입력 검사와 변경 목록 계산 (서버 utils/balanceValidation.js와 같은 규칙)

export type BalanceRow = {
    mb_no: number;
    user_name: string;
    user_id: string;
    user_stip: number | null;
    user_vaca: number | null;
};

// 입력칸 문자열 — 키가 없으면 수정하지 않은 칸
export type BalanceDraft = Record<number, { stip?: string; vaca?: string }>;

export type BalanceChange = {
    mbNo: number;
    name: string;
    stip: number;
    vaca: number;
    expectedStip: number | null;
    expectedVaca: number | null;
};

export type BalanceLogRow = {
    id: number;
    kind: 'admin' | 'apply' | 'cancel';
    stip_before: number | null;
    stip_after: number | null;
    vaca_before: number | null;
    vaca_after: number | null;
    memo: string;
    actor_name: string | null;
    created_at: string;
};

export const LOG_KIND_LABEL: Record<BalanceLogRow['kind'], string> = { admin: '관리자 조정', apply: '신청', cancel: '취소' };

const MAX_BALANCE = 365;

// 오류 문구, 올바르면 null
export function validateBalance(kind: 'stip' | 'vaca', value: string): string | null {
    if (!value.trim()) return '숫자를 입력해 주세요';
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > MAX_BALANCE) return '0~365 사이로 입력해 주세요';
    if (kind === 'stip' && !Number.isInteger(n * 2)) return '0.5일 단위로 입력해 주세요';
    if (kind === 'vaca' && !Number.isInteger(n)) return '정수로 입력해 주세요';
    return null;
}

// 행 오류 — 한 칸이라도 고친 행은 두 칸 모두 검사 (안 고친 칸의 잘못된 현재값도 함께 저장되므로)
export function balanceErrors(row: BalanceRow, edit: BalanceDraft[number] | undefined): Record<'stip' | 'vaca', string | null> {
    if (!edit) return { stip: null, vaca: null };
    return {
        stip: validateBalance('stip', edit.stip ?? String(row.user_stip ?? 0)),
        vaca: validateBalance('vaca', edit.vaca ?? String(row.user_vaca ?? 0)),
    };
}

// 저장할 변경 목록 — 올바르고 실제로 달라진 행만. 안 바꾼 쪽은 현재값(없으면 0)으로 덮어씀
export function diffBalances(rows: BalanceRow[], draft: BalanceDraft): BalanceChange[] {
    return rows.flatMap(row => {
        const edit = draft[row.mb_no];
        if (!edit) return [];
        const stipText = edit.stip ?? String(row.user_stip ?? 0);
        const vacaText = edit.vaca ?? String(row.user_vaca ?? 0);
        if (validateBalance('stip', stipText) || validateBalance('vaca', vacaText)) return [];
        const stip = Number(stipText);
        const vaca = Number(vacaText);
        if (stip === row.user_stip && vaca === row.user_vaca) return [];
        return [{ mbNo: row.mb_no, name: row.user_name, stip, vaca, expectedStip: row.user_stip, expectedVaca: row.user_vaca }];
    });
}
