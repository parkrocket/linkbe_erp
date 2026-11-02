// 회사 홈페이지(linkbe.kr) 관리 — 권한·폼 검사·라벨 (서버 adminHomepageController와 같은 규칙)
import { kstDate, kstTime } from './schedule';

export type Board = 'notice' | 'portfolio';
export const BOARD_LABEL: Record<Board, string> = { notice: '공지사항', portfolio: '포트폴리오' };

export const INQUIRY_KIND_LABEL = { qna: '1:1 문의', estimate: '견적 요청' } as const;
export const INQUIRY_STATUS_LABEL = { new: '신규', in_progress: '처리 중', done: '완료' } as const;
export const INQUIRY_CATEGORY_LABEL: Record<string, string> = { homepage: '홈페이지', design: '디자인', blog: '블로그 디자인' };
export const CONTACT_METHOD_LABEL: Record<string, string> = { email: '이메일 회신', phone: '전화 연락' };
export type InquiryStatus = keyof typeof INQUIRY_STATUS_LABEL;

// 관리 API 응답 행 (DB 칸 그대로)
export type PostRow = {
    id: number;
    title: string;
    body_html?: string;
    thumbnail_file_id: number | null;
    client: string | null;
    category: string | null;
    site_url: string | null;
    show_on_main: number;
    sort_order: number;
    is_visible: number;
    created_at: string;
};
export type FaqRow = { id: number; question: string; answer_html: string; sort_order: number; is_visible: number };
export type PopupRow = {
    id: number;
    title: string;
    image_file_id: number | null;
    link_url: string | null;
    starts_at: string;
    ends_at: string;
    pos_left: number;
    pos_top: number;
    width: number;
    is_visible: number;
};
export type PageRow = { slug: string; title: string; body_html?: string; updated_at: string };
export type InquiryRow = {
    id: number;
    kind: keyof typeof INQUIRY_KIND_LABEL;
    name: string;
    company: string;
    category: string | null;
    status: InquiryStatus;
    created_at: string;
    phone?: string;
    email?: string;
    contact_method?: string | null;
    body?: string;
    admin_memo?: string | null;
};
export type InquiryFile = { id: number; name: string; mime: string; size: number };

export const fileUrl = (id: number | null) => (id ? `/node/api/public/homepage/files/${id}` : null);

// 관리자 또는 홈페이지 권한을 받은 직원
export const canManageHomepage = (user: { user_role: string; homepage_access?: number | null }) =>
    user.user_role === 'admin' || Number(user.homepage_access) === 1;

// 서버 시각(ISO) → <input type="datetime-local"> 값(한국 시간)
export const kstInput = (iso: string) => (iso ? `${kstDate(iso)}T${kstTime(iso)}` : '');

export type PostForm = {
    title: string;
    bodyHtml: string;
    isVisible: boolean;
    client: string;
    category: string;
    siteUrl: string;
    showOnMain: boolean;
    sortOrder: string;
    thumbnailFileId: number | null;
};
export type FormErrors<T> = Partial<Record<keyof T, string>>;

export function validatePostForm(form: PostForm): FormErrors<PostForm> {
    const errors: FormErrors<PostForm> = {};
    if (!form.title.trim()) errors.title = '제목을 입력해 주세요.';
    else if (form.title.trim().length > 200) errors.title = '제목은 200자까지예요.';
    if (form.siteUrl.trim() && !/^https?:\/\/\S+$/.test(form.siteUrl.trim())) errors.siteUrl = 'https:// 로 시작하는 주소를 입력해 주세요.';
    if (form.sortOrder.trim() && !/^-?\d+$/.test(form.sortOrder.trim())) errors.sortOrder = '정수로 입력해 주세요.';
    return errors;
}

export type PopupForm = {
    title: string;
    imageFileId: number | null;
    linkUrl: string;
    startsAt: string;
    endsAt: string;
    posLeft: string;
    posTop: string;
    width: string;
    isVisible: boolean;
};

const intBetween = (v: string, min: number, max: number) => /^\d+$/.test(v.trim()) && Number(v) >= min && Number(v) <= max;

export function validatePopupForm(form: PopupForm): FormErrors<PopupForm> {
    const errors: FormErrors<PopupForm> = {};
    if (!form.title.trim()) errors.title = '제목을 입력해 주세요.';
    if (!form.imageFileId) errors.imageFileId = '이미지를 올려 주세요.';
    if (!form.startsAt) errors.startsAt = '시작 시각을 입력해 주세요.';
    if (!form.endsAt) errors.endsAt = '끝 시각을 입력해 주세요.';
    else if (form.startsAt && form.endsAt <= form.startsAt) errors.endsAt = '끝 시각이 시작보다 늦어야 해요.';
    if (form.linkUrl.trim() && !/^https?:\/\/\S+$/.test(form.linkUrl.trim())) errors.linkUrl = 'https:// 로 시작하는 주소를 입력해 주세요.';
    if (!intBetween(form.width, 100, 1200)) errors.width = '100~1200 사이로 입력해 주세요.';
    if (!intBetween(form.posLeft, 0, 2000)) errors.posLeft = '0~2000 사이로 입력해 주세요.';
    if (!intBetween(form.posTop, 0, 2000)) errors.posTop = '0~2000 사이로 입력해 주세요.';
    return errors;
}
