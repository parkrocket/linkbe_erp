'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode };

// 브라우저 기본 <dialog> — Esc 닫기·포커스 가두기·배경 비활성화를 네이티브로 처리
export function Modal({ open, title, onClose, children }: Props) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    return (
        <dialog
            ref={ref}
            onClose={onClose}
            aria-labelledby="modal-title"
            // 배경(백드롭) 클릭 시 닫기
            onClick={event => event.target === ref.current && onClose()}
            className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40"
        >
            <div className="p-6">
                <div className="mb-5 flex items-center justify-between">
                    <h2 id="modal-title" className="text-lg font-bold">
                        {title}
                    </h2>
                    <button
                        type="button"
                        aria-label="닫기"
                        onClick={onClose}
                        className="rounded-md p-1 text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                    >
                        <X className="size-5" />
                    </button>
                </div>
                {children}
            </div>
        </dialog>
    );
}
