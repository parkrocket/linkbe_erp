import { redirect } from 'next/navigation';

// 예전 주소 /work/settings → 관리자 페이지의 업무 설정(11-05 옮김, 관리자만 — 관리자가 아니면 그쪽에서 다시 보냄)
export default function SettingsRoute() {
    redirect('/admin/work/categories');
}
