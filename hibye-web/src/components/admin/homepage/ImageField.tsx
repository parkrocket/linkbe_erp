'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { fileUrl } from '@/lib/homepage';
import { homepageErrorMessage, uploadImage } from './homepageApi';

// 대표·팝업 이미지 한 장 — 올리면 공개 파일 id를 돌려줌
export function ImageField({
    label,
    fileId,
    onChange,
    error,
}: {
    label: string;
    fileId: number | null;
    onChange: (id: number | null) => void;
    error?: string;
}) {
    const ref = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    const pick = async (file: File | undefined) => {
        if (!file) return;
        setUploading(true);
        setUploadError('');
        try {
            onChange((await uploadImage(file)).id);
        } catch (e) {
            setUploadError(homepageErrorMessage(e));
        } finally {
            setUploading(false);
            if (ref.current) ref.current.value = '';
        }
    };

    return (
        <div className="flex flex-col gap-1 text-sm font-medium">
            <span>{label}</span>
            <div className="flex items-center gap-3">
                {fileId ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 관리 화면 미리보기(외부 최적화 불필요)
                    <img src={fileUrl(fileId)!} alt="" className="size-20 rounded-lg border border-line object-cover" />
                ) : (
                    <div className="flex size-20 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">
                        없음
                    </div>
                )}
                <Button variant="secondary" disabled={uploading} onClick={() => ref.current?.click()}>
                    {uploading ? '올리는 중…' : fileId ? '바꾸기' : '올리기'}
                </Button>
                {fileId && (
                    <Button variant="ghost" onClick={() => onChange(null)}>
                        빼기
                    </Button>
                )}
            </div>
            <input
                ref={ref}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={e => pick(e.target.files?.[0])}
            />
            {(uploadError || error) && <span className="text-xs font-normal text-rejected-fg">{uploadError || error}</span>}
        </div>
    );
}
