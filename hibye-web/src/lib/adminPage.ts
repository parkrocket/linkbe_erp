import { redirect } from 'next/navigation';
import { getCurrentUser } from './auth';
import { HOMEPAGE_HOME } from './adminNav';

// 관리자 전용 관리 화면 — layout이 로그인·관리 권한은 이미 확인. 홈페이지 권한자는 문의함으로
export async function requireAdminPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/login?redirect=/admin');
    if (user.user_role !== 'admin') redirect(HOMEPAGE_HOME);
    return user;
}
