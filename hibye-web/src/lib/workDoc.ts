// 업무 문서(견적·계약서) 권한 판단·하위 탭
import type { User } from './types';

// 관리자는 권한을 가진 것으로 봄 (서버 requireAuth와 같은 기준)
export const canWorkDoc = (user: Pick<User, 'user_role' | 'work_doc_access'>) =>
    user.user_role === 'admin' || Number(user.work_doc_access) === 1;

export const WORK_TABS = (user: Pick<User, 'user_role' | 'work_doc_access'>): { href: string; label: string }[] => [
    { href: '/work/expense', label: '경비' },
    ...(canWorkDoc(user)
        ? [
              { href: '/work/contracts', label: '견적·계약서' },
              { href: '/work/ledger', label: '매출/매입' },
              { href: '/work/settings', label: '설정' },
          ]
        : []),
];
