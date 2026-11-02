'use client';

import { Bold, Heading2, Heading3, ImagePlus, Link2, List, ListOrdered } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { homepageErrorMessage, uploadImage } from './homepageApi';

// 글 편집기 — 의존성 없이 contentEditable + 기본 서식. 저장 시 서버가 허용 태그만 남김(정제)
// ponytail: execCommand(구식이지만 모든 브라우저 지원)·붙여넣기는 글자만 — 표·고급 서식이 필요하면 TipTap 도입
export function RichTextEditor({ value, onChange, label }: { value: string; onChange: (html: string) => void; label: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);

    // 처음 한 번만 값을 넣음 (입력 중 다시 넣으면 커서가 튐)
    useEffect(() => {
        if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const emit = () => onChange(ref.current?.innerHTML ?? '');
    const run = (command: string, arg?: string) => {
        ref.current?.focus();
        document.execCommand(command, false, arg);
        emit();
    };

    const addLink = () => {
        const url = window.prompt('링크 주소 (https://...)');
        if (url && /^https?:\/\//.test(url)) run('createLink', url);
    };

    const addImage = async (file: File | undefined) => {
        if (!file) return;
        setError('');
        setUploading(true);
        try {
            const { url } = await uploadImage(file);
            run('insertImage', url);
        } catch (e) {
            setError(homepageErrorMessage(e));
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    // 버튼 목록은 데이터만, 실제 동작은 클릭 처리에서 (렌더 중 ref 접근 금지 규칙)
    const TOOLS = [
        ['bold', '굵게', <Bold key="b" className="size-4" />],
        ['h2', '큰 제목', <Heading2 key="h2" className="size-4" />],
        ['h3', '작은 제목', <Heading3 key="h3" className="size-4" />],
        ['ul', '목록', <List key="ul" className="size-4" />],
        ['ol', '번호 목록', <ListOrdered key="ol" className="size-4" />],
        ['link', '링크', <Link2 key="a" className="size-4" />],
        ['image', '이미지', <ImagePlus key="img" className="size-4" />],
    ] as const;
    const onTool = (tool: (typeof TOOLS)[number][0]) => {
        if (tool === 'bold') run('bold');
        else if (tool === 'h2' || tool === 'h3') run('formatBlock', tool);
        else if (tool === 'ul') run('insertUnorderedList');
        else if (tool === 'ol') run('insertOrderedList');
        else if (tool === 'link') addLink();
        else fileRef.current?.click();
    };

    return (
        <div className="flex flex-col gap-1 text-sm font-medium text-ink">
            <span>{label}</span>
            <div className="rounded-lg border border-line bg-white focus-within:border-primary">
                <div role="toolbar" aria-label={`${label} 서식`} className="flex flex-wrap gap-0.5 border-b border-line p-1">
                    {TOOLS.map(([tool, name, icon]) => (
                        <button
                            key={name}
                            type="button"
                            aria-label={name}
                            title={name}
                            onMouseDown={e => e.preventDefault()} // 버튼을 눌러도 편집 영역 선택이 풀리지 않게
                            onClick={() => onTool(tool)}
                            disabled={uploading}
                            className="rounded p-1.5 text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
                        >
                            {icon}
                        </button>
                    ))}
                    {uploading && <span className="self-center px-2 text-xs text-muted">이미지 올리는 중…</span>}
                </div>
                <div
                    ref={ref}
                    role="textbox"
                    aria-multiline="true"
                    aria-label={label}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={emit}
                    onBlur={emit}
                    // 붙여넣기는 글자만 (다른 사이트·워드 서식이 섞이지 않게)
                    onPaste={e => {
                        e.preventDefault();
                        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
                        emit();
                    }}
                    className="prose-hp min-h-48 max-w-none p-3 text-sm font-normal leading-relaxed outline-none [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:font-bold [&_img]:my-2 [&_img]:max-w-full [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                />
            </div>
            <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={e => addImage(e.target.files?.[0])}
            />
            {error && <span className="text-xs font-normal text-rejected-fg">{error}</span>}
        </div>
    );
}
