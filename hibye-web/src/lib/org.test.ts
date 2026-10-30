import { describe, expect, it } from 'vitest';
import { orgMembers } from './org';

const u = (mb_no: number, user_name: string, user_status: string, dept_id: number | null, position_id: number | null) => ({
    mb_no,
    user_name,
    user_status,
    dept_id,
    position_id,
});

describe('orgMembers', () => {
    const users = [
        u(1, '홍길동', 'inactive', 10, 5),
        u(2, '김철수', 'approved', 10, null),
        u(3, '가나다', 'approved', 10, 6),
        u(4, '타부서', 'approved', 11, 5),
    ];

    it('부서 소속만, 승인 먼저 그다음 이름순', () => {
        expect(orgMembers(users, 'departments', 10).map(m => m.mb_no)).toEqual([3, 2, 1]);
    });

    it('직급 기준', () => {
        expect(orgMembers(users, 'positions', 5).map(m => m.mb_no)).toEqual([4, 1]);
    });

    it('소속 없음', () => {
        expect(orgMembers(users, 'departments', 99)).toEqual([]);
    });
});
