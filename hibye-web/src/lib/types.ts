// nodejs-server 응답 형태 (필요한 필드만 명시, 나머지는 unknown)

export type User = {
    user_id: string;
    user_name: string;
    cp_id: number;
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
