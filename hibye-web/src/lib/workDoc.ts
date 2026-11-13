// 업무 문서(견적·계약서) 권한 판단·하위 탭
import type { User } from './types';

// 관리자는 권한을 가진 것으로 봄 (서버 requireAuth와 같은 기준)
export const canWorkDoc = (user: Pick<User, 'user_role' | 'work_doc_access'>) =>
    user.user_role === 'admin' || Number(user.work_doc_access) === 1;

// 거래처 접속정보 권한 (업무 문서 권한과 별개, 관리자는 가진 것으로 봄)
export const canClientSecret = (user: Pick<User, 'user_role' | 'client_secret_access'>) =>
    user.user_role === 'admin' || Number(user.client_secret_access) === 1;

export const WORK_TABS = (user: Pick<User, 'user_role' | 'work_doc_access' | 'client_secret_access'>): { href: string; label: string }[] => [
    { href: '/work/expense', label: '경비' },
    ...(canWorkDoc(user)
        ? [
              { href: '/work/contracts', label: '견적·계약서' },
              { href: '/work/ledger', label: '매출/매입' },
              { href: '/work/site-contracts', label: '계약 관리' },
          ]
        : []),
    ...(canClientSecret(user) ? [{ href: '/work/clients', label: '거래처 접속정보' }] : []),
    // 11-05: 바이럴은 쓰지 않아 메뉴에서 뺌(화면·데이터는 남김), 설정은 관리자 페이지(/admin/work/*)로 옮김
];
