'use client';

import { useState } from 'react';
import { Modal } from '@/components/leave/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { apiFetch } from '@/lib/api';
import {
    emptyForm,
    fromItem,
    scheduleErrorMessage,
    toEventPayload,
    validateEventForm,
    type CalendarItem,
    type EventErrors,
    type EventForm,
} from '@/lib/schedule';

type Editing = { mode: 'add'; date: string } | { mode: 'edit'; item: CalendarItem };

// 일정 추가·수정 — 하루 종일(여러 날) / 시간 지정, 메모 (서버도 같은 규칙으로 검사)
export function EventDialog({ editing, onClose, onSaved }: { editing: Editing; onClose: () => void; onSaved: (text: string) => void }) {
    const initial = editing.mode === 'add' ? emptyForm(editing.date) : fromItem(editing.item);
    const [form, setForm] = useState<EventForm>(initial);
    const [errors, setErrors] = useState<EventErrors>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) => {
        setForm(prev => {
            const next = { ...prev, [key]: value };
            // 시작 날짜를 끝보다 뒤로 옮기면 끝도 같이 (하루짜리 입력이 편하게)
            if (key === 'startDate' && next.endDate < next.startDate) next.endDate = next.startDate;
            return next;
        });
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };
    const dirty = (Object.keys(form) as (keyof EventForm)[]).some(k => form[k] !== initial[k]);

    const save = async () => {
        setError('');
        const found = validateEventForm(form);
        setErrors(found);
        if (Object.keys(found).length) return;
        setSaving(true);
        try {
            if (editing.mode === 'add') {
                await apiFetch('/api/calendar/in', { method: 'POST', body: toEventPayload(form) });
                onSaved('일정을 추가했어요.');
            } else {
                await apiFetch('/api/calendar/update', { method: 'POST', body: { id: editing.item.id, ...toEventPayload(form) } });
                onSaved('일정을 수정했어요.');
            }
        } catch (e) {
            setError(scheduleErrorMessage(e));
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            title={editing.mode === 'add' ? '일정 추가' : '일정 수정'}
            onClose={onClose}
            canClose={() => saving || !dirty || window.confirm('저장하지 않은 변경이 있어요. 닫을까요?')}
        >
            <div className="flex flex-col gap-4">
                <TextField
                    label="제목"
                    name="title"
                    maxLength={100}
                    value={form.title}
                    onChange={e => set('title', e.target.value)}
                    error={errors.title}
                />
                <label className="flex items-center gap-2 text-sm font-medium text-ink">
                    <input
                        type="checkbox"
                        checked={form.allDay}
                        onChange={e => set('allDay', e.target.checked)}
                        className="size-4 accent-primary"
                    />
                    하루 종일
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <TextField
                        label="시작"
                        name="startDate"
                        type="date"
                        value={form.startDate}
                        onChange={e => set('startDate', e.target.value)}
                    />
                    <TextField
                        label="끝"
                        name="endDate"
                        type="date"
                        value={form.endDate}
                        onChange={e => set('endDate', e.target.value)}
                        error={errors.endDate}
                    />
                    {!form.allDay && (
                        <>
                            <TextField
                                label="시작 시각"
                                name="startTime"
                                type="time"
                                value={form.startTime}
                                onChange={e => set('startTime', e.target.value)}
                            />
                            <TextField
                                label="끝 시각"
                                name="endTime"
                                type="time"
                                value={form.endTime}
                                onChange={e => set('endTime', e.target.value)}
                                error={errors.endTime}
                            />
                        </>
                    )}
                </div>
                <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                    메모 (선택)
                    <textarea
                        rows={3}
                        maxLength={500}
                        value={form.description}
                        onChange={e => set('description', e.target.value)}
                        className="w-full resize-y rounded-lg border border-line bg-white px-3 py-2.5 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft"
                    />
                    {errors.description && <span className="text-xs font-normal text-rejected-fg">{errors.description}</span>}
                </label>
                {error && (
                    <p role="alert" className="text-sm text-rejected-fg">
                        {error}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" disabled={saving} onClick={onClose}>
                        취소
                    </Button>
                    <Button disabled={saving} onClick={save}>
                        {saving ? '저장 중…' : '저장'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
