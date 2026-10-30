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
    toProfileForm,
    validateProfileForm,
    type EmploymentType,
    type Gender,
    type MemberDetail,
    type ProfileErrors,
    type ProfileForm,
} from '@/lib/profile';
import { joinedAt, saveBalances, saveProfile, STATUS_LABEL, type OrgItem, type OrgLists } from './adminApi';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

// 직원 상세 팝업 — 인사 정보 열람·수정 + 연차·휴가 조정 (스펙 4장)
export function MemberDialog({ mbNo, onClose, onChanged }: { mbNo: number; onClose: () => void; onChanged: () => void }) {
    const detail = useApiData<{ user?: MemberDetail }>(`/api/admin/users/${mbNo}`, undefined, 'GET');
    const org = useApiData<Partial<OrgLists>>('/api/admin/org', undefined, 'GET');
    const user = detail.state.status === 'ok' ? detail.state.data.user : undefined;
    const loading = detail.state.status === 'loading' || org.state.status === 'loading';
    const failed = detail.state.status === 'error' || org.state.status === 'error' || (detail.state.status === 'ok' && !user);

    return (
        <Modal open title={user ? `${user.user_name}님 정보` : '직원 정보'} onClose={onClose}>
            <div className="max-h-[70vh] overflow-y-auto pr-1">
                {loading && <Skeleton className="h-64 w-full" />}
                {!loading && failed && (
                    <ErrorState
                        onRetry={() => {
                            detail.reload();
                            org.reload();
                        }}
                    />
                )}
                {!loading && !failed && user && org.state.status === 'ok' && (
                    <MemberEditor
                        key={JSON.stringify(user)} // 다시 불러오면 폼도 새 값으로
                        user={user}
                        departments={org.state.data.departments ?? []}
                        positions={org.state.data.positions ?? []}
                        onSaved={() => {
                            detail.reload();
                            onChanged();
                        }}
                    />
                )}
            </div>
        </Modal>
    );
}

function MemberEditor({
    user,
    departments,
    positions,
    onSaved,
}: {
    user: MemberDetail;
    departments: OrgItem[];
    positions: OrgItem[];
    onSaved: () => void;
}) {
    const [form, setForm] = useState<ProfileForm>(() =>
        toProfileForm(
            user,
            departments.map(d => d.id),
            positions.map(p => p.id),
        ),
    );
    const [errors, setErrors] = useState<ProfileErrors>({});
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<Notice>(null);

    const set = (key: keyof ProfileForm, value: string) => {
        setForm(prev => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    const save = async () => {
        setNotice(null);
        const found = validateProfileForm(form);
        setErrors(found);
        if (Object.keys(found).length) return;
        setSaving(true);
        try {
            await saveProfile(user.mb_no, form);
            setNotice({ tone: 'ok', text: '정보를 저장했어요.' });
            onSaved();
        } catch (error) {
            setNotice({ tone: 'error', text: adminErrorMessage(error) });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1.5 rounded-lg bg-surface p-3 text-sm">
                <dt className="text-muted">이메일</dt>
                <dd className="truncate">{user.user_email || user.user_id}</dd>
                <dt className="text-muted">가입일</dt>
                <dd>{joinedAt(user.user_datetime)}</dd>
                <dt className="text-muted">상태</dt>
                <dd className="flex gap-1.5">
                    <Badge tone="neutral">{STATUS_LABEL[user.user_status]}</Badge>
                    {user.user_role === 'admin' && <Badge tone="info">관리자</Badge>}
                </dd>
            </dl>

            <section aria-label="인사 정보" className="flex flex-col gap-3">
                <TextField label="이름" name="name" value={form.name} onChange={e => set('name', e.target.value)} error={errors.name} />
                <TextField
                    label="연락처"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    error={errors.phone}
                />
                <div className="grid grid-cols-2 gap-3">
                    <TextField
                        label="입사일"
                        name="doe"
                        type="date"
                        value={form.doe}
                        onChange={e => set('doe', e.target.value)}
                        error={errors.doe}
                    />
                    <TextField
                        label="생년월일"
                        name="birth"
                        type="date"
                        value={form.birth}
                        onChange={e => set('birth', e.target.value)}
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
                    onChange={value => set('gender', value)}
                />
                <div className="grid grid-cols-2 gap-3">
                    <SelectField
                        label="부서"
                        value={form.deptId}
                        onChange={value => set('deptId', value)}
                        options={departments.map(d => ({ value: String(d.id), label: d.name }))}
                    />
                    <SelectField
                        label="직급"
                        value={form.positionId}
                        onChange={value => set('positionId', value)}
                        options={positions.map(p => ({ value: String(p.id), label: p.name }))}
                    />
                </div>
                {(!departments.length || !positions.length) && (
                    <p className="text-xs text-muted">부서·직급은 &apos;조직&apos; 탭에서 먼저 추가해 주세요.</p>
                )}
                <SelectField
                    label="고용형태"
                    value={form.employmentType}
                    onChange={value => set('employmentType', value)}
                    options={(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map(t => ({ value: t, label: EMPLOYMENT_LABEL[t] }))}
                />
                {notice && <NoticeLine notice={notice} />}
                <Button onClick={save} disabled={saving} className="self-end">
                    {saving ? '저장 중…' : '정보 저장'}
                </Button>
            </section>

            <BalanceEditor user={user} onSaved={onSaved} />
        </div>
    );
}

// 연차·휴가 — 연차·휴가 탭과 같은 규칙(덮어쓰기, 사유 필수, 장부 기록)
function BalanceEditor({ user, onSaved }: { user: MemberDetail; onSaved: () => void }) {
    const row: BalanceRow = {
        mb_no: user.mb_no,
        user_name: user.user_name,
        user_id: user.user_id,
        user_stip: user.user_stip,
        user_vaca: user.user_vaca,
    };
    const [edit, setEdit] = useState<{ stip?: string; vaca?: string }>({});
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<Notice>(null);

    const errors = balanceErrors(row, Object.keys(edit).length ? edit : undefined);
    const changes = diffBalances([row], { [row.mb_no]: edit });
    const canSave = changes.length > 0 && !errors.stip && !errors.vaca && reason.trim().length > 0;

    const save = async () => {
        setSaving(true);
        setNotice(null);
        try {
            await saveBalances(reason.trim(), changes);
            setNotice({ tone: 'ok', text: '연차·휴가를 저장했어요.' });
            onSaved();
        } catch (error) {
            setNotice({ tone: 'error', text: adminErrorMessage(error) });
            // 그 사이 잔여가 바뀜 → 최신 값으로 다시 불러옴 (덮어쓰기 방지)
            if (error instanceof ApiError && error.reason === 'Balance changed') onSaved();
        } finally {
            setSaving(false);
        }
    };

    return (
        <section aria-label="연차·휴가" className="flex flex-col gap-3 border-t border-line pt-4">
            <h3 className="text-sm font-bold">연차·휴가</h3>
            <div className="grid grid-cols-2 gap-3">
                <TextField
                    label="남은 연차 (0.5일 단위)"
                    name="balance-stip"
                    type="number"
                    step={0.5}
                    min={0}
                    max={365}
                    value={edit.stip ?? String(row.user_stip ?? 0)}
                    onChange={e => setEdit(prev => ({ ...prev, stip: e.target.value }))}
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
                    onChange={e => setEdit(prev => ({ ...prev, vaca: e.target.value }))}
                    error={errors.vaca ?? undefined}
                />
            </div>
            <TextField
                label="변경 사유"
                name="balance-reason"
                maxLength={200}
                placeholder="예: 2027년 연차 부여"
                value={reason}
                onChange={e => setReason(e.target.value)}
            />
            {notice && <NoticeLine notice={notice} />}
            <Button variant="secondary" onClick={save} disabled={!canSave || saving} className="self-end">
                {saving ? '저장 중…' : '연차·휴가 저장'}
            </Button>
        </section>
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

function NoticeLine({ notice }: { notice: NonNullable<Notice> }) {
    return (
        <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`rounded-lg px-3 py-2 text-sm ${notice.tone === 'error' ? 'bg-rejected-bg text-rejected-fg' : 'bg-approved-bg text-approved-fg'}`}
        >
            {notice.text}
        </p>
    );
}
