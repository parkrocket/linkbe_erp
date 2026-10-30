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
            {/* 제목은 고정, 본문만 스크롤 — 스크롤바는 팝업 가장자리 쪽(mr-1.5)에 두고 내용과 18px 띄움
                (팝업마다 스크롤 영역을 따로 만들지 않음 — 모든 팝업 같은 간격) */}
            <div className="flex max-h-[85vh] flex-col">
                <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-5">
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
                <div className="mr-1.5 min-h-0 flex-1 overflow-y-auto pb-6 pl-6 pr-[18px]">{children}</div>
            </div>
        </dialog>
    );
}
