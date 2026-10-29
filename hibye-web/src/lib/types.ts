// nodejs-server 응답 형태 (필요한 필드만 명시, 나머지는 unknown)

export type User = {
    user_id: string;
    user_name: string;
    cp_id: number;
    // 남은 연차(user_stip)·휴가(user_vaca) — DB DECIMAL이라 문자열로 올 수 있음
    user_stip?: number | string | null;
    user_vaca?: number | string | null;
    [key: string]: unknown;
};

// lk_ctw(출퇴근) + lk_user 조인 행
export type GtwRecord = {
    user_id: string;
    user_name?: string;
    start_time: string | null;
    end_time: string | null;
    gtw_location: 'office' | 'home' | null;
    type?: string | null;
};

// 근태 종류 코드 (기존 API 값)
export type LeaveType = 'day' | 'half' | 'vacation' | 'home';

// lk_vacation 행 (vacation/list)
export type VacationRecord = {
    id?: number;
    date: string;
    type: LeaveType;
};
