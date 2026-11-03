import { redirect } from 'next/navigation';

// 업무 첫 화면 = 경비 (하위 메뉴가 늘어나면 여기서 고름)
export default function WorkPage() {
    redirect('/work/expense');
}
