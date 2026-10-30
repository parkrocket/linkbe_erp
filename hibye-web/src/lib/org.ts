// 조직 탭 — 부서·직급 소속 명단 (관리자 직원 목록을 화면에서 거름)

type Member = { mb_no: number; user_name: string; user_status: string; dept_id: number | null; position_id: number | null };

// 승인된 직원 먼저, 그다음 이름순
export function orgMembers<T extends Member>(users: T[], kind: 'departments' | 'positions', id: number): T[] {
    const key = kind === 'departments' ? 'dept_id' : 'position_id';
    return users
        .filter(u => u[key] === id)
        .sort((a, b) => Number(b.user_status === 'approved') - Number(a.user_status === 'approved') || a.user_name.localeCompare(b.user_name, 'ko'));
}
