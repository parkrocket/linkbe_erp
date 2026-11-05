import { redirect } from 'next/navigation';
import { HOMEPAGE_HOME } from '@/lib/adminNav';

// /admin/homepage → 문의함(가장 자주 확인)
export default function Page() {
    redirect(HOMEPAGE_HOME);
}
