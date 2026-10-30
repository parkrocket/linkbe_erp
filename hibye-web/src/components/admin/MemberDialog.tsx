'use client';

import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api';
import { adminErrorMessage } from '@/lib/authMessages';
import { balanceErrors, diffBalances, type BalanceRow } from '@/lib/balance';
import {
    EMPLOYMENT_LABEL,
    GENDER_LABEL,
    isSameProfile,
    toProfileForm,
    validateProfileForm,
    type EmploymentType,
    type Gender,
    type MemberDetail,
    type ProfileErrors,
    type ProfileForm,
} from '@/lib/profile';
import { joinedAt, saveBalances, saveProfile, STATUS_LABEL, STATUS_TONE, type OrgItem, type OrgLists } from './adminApi';

type Tab = 'profile' | 'balance';
type Notice = { tab: Tab; tone: 'ok' | 'error'; text: string } | null;
type BalanceEdit = { stip?: string; vaca?: string };

const days = (v: number | null) => `${v ?? 0}일`;

// 직원 상세 팝업 — 탭(기본 정보 / 연차·휴가), 탭마다 하단 고정 저장 버튼, 저장 안 된 변경은 닫기 전 확인
// 입력 상태는 이 컴포넌트가 가짐: form이 null이면 '수정 안 함' → 서버 값에서 바로 계산 (불러온 뒤 상태 복사 불필요)
export function MemberDialog({ mbNo, onClose, onChanged }: { mbNo: number; onClose: () => void; onChanged: () => void }) {
    const detail = useApiData<{ user?: MemberDetail }>(`/api/admin/users/${mbNo}`, undefined, 'GET');
    const org = useApiData<Partial<OrgLists>>('/api/admin/org', undefined, 'GET');
    const [tab, setTab] = useState<Tab>('profile');
    const [form, setForm] = useState<ProfileForm | null>(null);
    const [errors, setErrors] = useState<ProfileErrors>({});
    const [edit, setEdit] = useState<BalanceEdit>({});
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<Notice>(null);

    const user = detail.state.status === 'ok' ? detail.state.data.user : undefined;
    const departments = org.state.status === 'ok' ? (org.state.data.departments ?? []) : [];
    const positions = org.state.status === 'ok' ? (org.state.data.positions ?? []) : [];
    const loading = detail.state.status === 'loading' || org.state.status === 'loading';
    const ready = !loading && user && org.state.status === 'ok';

    // 저장 안 된 변경 — 저장 후 새로고침되면 서버 값과 같아져 자동으로 해제
    const baseline = user
        ? toProfileForm(
              user,
              departments.map(d => d.id),
              positions.map(p => p.id),
          )
        : null;
    const current = form ?? baseline;
    const row: BalanceRow | null = user
        ? { mb_no: user.mb_no, user_name: user.user_name, user_id: user.user_id, user_stip: user.user_stip, user_vaca: user.user_vaca }
        : null;
    const balanceChanges = row ? diffBalances([row], { [row.mb_no]: edit }) : [];
    const dirty = {
        profile: !!form && !!baseline && !isSameProfile(form, baseline),
        balance: balanceChanges.length > 0 || reason.trim() !== '',
    };

    const canClose = () => !(dirty.profile || dirty.balance) || window.confirm('저장하지 않은 변경이 있어요. 닫을까요?');
    const afterSave = () => {
        detail.refresh(); // 화면을 유지한 채 새로고침 (로딩으로 바뀌며 안내가 사라지지 않게)
        onChanged();
    };

    const saveInfo = async () => {
        if (!user || !current) return;
        setNotice(null);
        const found = validateProfileForm(current);
        setErrors(found);
        if (Object.keys(found).length) return;
        setSaving(true);
        try {
            await saveProfile(user.mb_no, current);
            setNotice({ tab: 'profile', tone: 'ok', text: '정보를 저장했어요.' });
            afterSave();
        } catch (error) {
            setNotice({ tab: 'profile', tone: 'error', text: adminErrorMessage(error) });
        } finally {
            setSaving(false);
        }
    };

    const saveBalance = async () => {
        setSaving(true);
        setNotice(null);
        try {
            await saveBalances(reason.trim(), balanceChanges);
            setNotice({ tab: 'balance', tone: 'ok', text: '연차·휴가를 저장했어요.' });
            setReason('');
            afterSave();
        } catch (error) {
            setNotice({ tab: 'balance', tone: 'error', text: adminErrorMessage(error) });
            // 그 사이 잔여가 바뀜 → 입력을 버리고 최신 값으로 (덮어쓰기 방지)
            if (error instanceof ApiError && error.reason === 'Balance changed') {
                setEdit({});
                afterSave();
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open size="lg" title={user ? `${user.user_name}님 정보` : '직원 정보'} onClose={onClose} canClose={canClose}>
            {loading && <Skeleton className="h-64 w-full" />}
            {!loading && !ready && (
                <ErrorState
                    onRetry={() => {
                        detail.reload();
                        org.reload();
                    }}
                />
            )}
            {ready && user && current && row && (
                <>
                    <div role="tablist" aria-label="직원 정보 메뉴" className="mb-5 flex gap-1 border-b border-line">
                        <TabButton active={tab === 'profile'} dirty={dirty.profile} onClick={() => setTab('profile')}>
                            기본 정보
                        </TabButton>
                        <TabButton active={tab === 'balance'} dirty={dirty.balance} onClick={() => setTab('balance')}>
                            연차·휴가
                        </TabButton>
                    </div>

                    {tab === 'profile' ? (
                        <ProfileFields
                            user={user}
                            form={current}
                            errors={errors}
                            departments={departments}
                            positions={positions}
                            onChange={(key, value) => {
                                setForm({ ...current, [key]: value });
                                if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
                            }}
                        />
                    ) : (
                        <BalanceFields row={row} edit={edit} reason={reason} onEdit={setEdit} onReason={setReason} />
                    )}

                    {/* 하단 고정 — 스크롤 위치와 상관없이 저장 버튼이 보이게 */}
                    <div className="sticky bottom-0 -mb-6 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-white py-4">
                        {notice?.tab === tab && (
                            <p
                                role={notice.tone === 'error' ? 'alert' : 'status'}
                                className={`mr-auto text-sm ${notice.tone === 'error' ? 'text-rejected-fg' : 'text-approved-fg'}`}
                            >
                                {notice.text}
                            </p>
                        )}
                        {tab === 'profile' ? (
                            <Button onClick={saveInfo} disabled={saving || !dirty.profile}>
                                {saving ? '저장 중…' : '정보 저장'}
                            </Button>
                        ) : (
                            <Button
                                onClick={saveBalance}
                                disabled={
                                    saving ||
                                    !balanceChanges.length ||
                                    !reason.trim() ||
                                    Object.values(balanceErrors(row, edit)).some(Boolean)
                                }
                            >
                                {saving ? '저장 중…' : '연차·휴가 저장'}
                            </Button>
                        )}
                    </div>
                </>
            )}
        </Modal>
    );
}

function ProfileFields({
    user,
    form,
    errors,
    departments,
    positions,
    onChange,
}: {
    user: MemberDetail;
    form: ProfileForm;
    errors: ProfileErrors;
    departments: OrgItem[];
    positions: OrgItem[];
    onChange: (key: keyof ProfileForm, value: string) => void;
}) {
    return (
        <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1.5 rounded-lg bg-surface p-3 text-sm">
                <dt className="text-muted">이메일</dt>
                <dd className="truncate">{user.user_email || user.user_id}</dd>
                <dt className="text-muted">가입일</dt>
                <dd>{joinedAt(user.user_datetime)}</dd>
                <dt className="text-muted">상태</dt>
                <dd className="flex gap-1.5">
                    <Badge tone={STATUS_TONE[user.user_status]}>{STATUS_LABEL[user.user_status]}</Badge>
                    {user.user_role === 'admin' && <Badge tone="info">관리자</Badge>}
                </dd>
                {/* 연차·휴가 탭으로 가지 않아도 잔여를 바로 확인 */}
                <dt className="text-muted">잔여</dt>
                <dd>
                    연차 {days(user.user_stip)} · 휴가 {days(user.user_vaca)}
                </dd>
            </dl>

            <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                    label="이름"
                    name="name"
                    maxLength={50}
                    value={form.name}
                    onChange={e => onChange('name', e.target.value)}
                    error={errors.name}
                />
                <TextField
                    label="연락처"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={e => onChange('phone', e.target.value)}
                    error={errors.phone}
                />
                <TextField
                    label="입사일"
                    name="doe"
                    type="date"
                    value={form.doe}
                    onChange={e => onChange('doe', e.target.value)}
                    error={errors.doe}
                />
                <TextField
                    label="생년월일"
                    name="birth"
                    type="date"
                    value={form.birth}
                    onChange={e => onChange('birth', e.target.value)}
                    error={errors.birth}
                />
            </div>
            <RadioGroup
                label="성별"
                name="profile-gender"
                value={form.gender}
                options={[
                    { value: '', label: '선택 안 함' },
                    ...(Object.keys(GENDER_LABEL) as Gender[]).map(g => ({ value: g, label: GENDER_LABEL[g] })),
                ]}
                onChange={value => onChange('gender', value)}
            />
            <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                    label="부서"
                    value={form.deptId}
                    onChange={value => onChange('deptId', value)}
                    options={departments.map(d => ({ value: String(d.id), label: d.name }))}
                />
                <SelectField
                    label="직급"
                    value={form.positionId}
                    onChange={value => onChange('positionId', value)}
                    options={positions.map(p => ({ value: String(p.id), label: p.name }))}
                />
                <SelectField
                    label="고용형태"
                    value={form.employmentType}
                    onChange={value => onChange('employmentType', value)}
                    options={(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map(t => ({ value: t, label: EMPLOYMENT_LABEL[t] }))}
                />
            </div>
            {(!departments.length || !positions.length) && (
                <p className="text-xs text-muted">부서·직급은 &apos;조직&apos; 탭에서 먼저 추가해 주세요.</p>
            )}
        </div>
    );
}

// 연차·휴가 — 연차·휴가 탭과 같은 규칙(덮어쓰기, 사유 필수, 장부 기록)
function BalanceFields({
    row,
    edit,
    reason,
    onEdit,
    onReason,
}: {
    row: BalanceRow;
    edit: BalanceEdit;
    reason: string;
    onEdit: (edit: BalanceEdit) => void;
    onReason: (reason: string) => void;
}) {
    const errors = balanceErrors(row, Object.keys(edit).length ? edit : undefined);
    return (
        <div className="flex flex-col gap-4">
            <p className="text-xs text-muted">입력한 값으로 남은 일수를 덮어써요. 변경 내역은 장부에 기록되고 #hibye-관리에 알려요.</p>
            <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                    label="남은 연차 (0.5일 단위)"
                    name="balance-stip"
                    type="number"
                    step={0.5}
                    min={0}
                    max={365}
                    value={edit.stip ?? String(row.user_stip ?? 0)}
                    onChange={e => onEdit({ ...edit, stip: e.target.value })}
                    error={errors.stip ?? undefined}
                />
                <TextField
                    label="남은 휴가"
                    name="balance-vaca"
                    type="number"
                    step={1}
                    min={0}
                    max={365}
                    value={edit.vaca ?? String(row.user_vaca ?? 0)}
                    onChange={e => onEdit({ ...edit, vaca: e.target.value })}
                    error={errors.vaca ?? undefined}
                />
            </div>
            <TextField
                label="변경 사유 (필수)"
                name="balance-reason"
                maxLength={200}
                placeholder="예: 2027년 연차 부여"
                value={reason}
                onChange={e => onReason(e.target.value)}
            />
        </div>
    );
}

function TabButton({
    active,
    dirty,
    onClick,
    children,
}: {
    active: boolean;
    dirty: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                active ? 'border-primary font-bold text-primary' : 'border-transparent text-muted hover:text-ink'
            }`}
        >
            {children}
            {/* 저장 안 된 변경 표시 */}
            {dirty && <span aria-label="저장 안 됨" className="size-1.5 rounded-full bg-primary" />}
        </button>
    );
}

function SelectField({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
}) {
    return (
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {label}
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft"
            >
                <option value="">선택 안 함</option>
                {options.map(o => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
