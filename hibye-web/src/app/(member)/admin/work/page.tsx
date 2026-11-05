import { redirect } from 'next/navigation';

// /admin/work → 첫 설정(분류)
export default function Page() {
    redirect('/admin/work/categories');
}
