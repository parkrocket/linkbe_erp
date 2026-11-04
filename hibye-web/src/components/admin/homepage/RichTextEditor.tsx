'use client';

import { Bold, Code, Heading2, Heading3, ImagePlus, Link2, List, ListOrdered, Table } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { homepageErrorMessage, uploadImage } from './homepageApi';

// 글 편집기 — 의존성 없이 contentEditable + 기본 서식. 저장 시 서버가 허용 태그만 남김(정제)
// ponytail: execCommand(구식이지만 모든 브라우저 지원)·붙여넣기는 글자만 — 표·고급 서식이 필요하면 TipTap 도입
// allowImage: 이미지 버튼(기본 켬) / allowTable: 표 삽입(양식용) / allowSource: HTML 원본 직접 고치기(양식용)
export function RichTextEditor({
    value,
    onChange,
    label,
    allowImage = true,
    allowTable = false,
    allowSource = false,
}: {
    value: string;
    onChange: (html: string) => void;
    label: string;
    allowImage?: boolean;
    allowTable?: boolean;
    allowSource?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [source, setSource] = useState<string | null>(null); // null이면 보통 편집, 문자열이면 HTML 원본 편집 중
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

    // 표: 행·칸 수를 묻고 테두리 있는 표를 커서 위치에 넣음 (칸에는 공백 문자 — 비면 커서를 못 둠)
    const addTable = () => {
        const rows = Number(window.prompt('행 수 (1~30)', '3'));
        const cols = Number(window.prompt('칸 수 (1~10)', '3'));
        if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || rows > 30 || cols < 1 || cols > 10) return;
        const td = '<td style="border:1px solid #999;padding:4px">&nbsp;</td>';
        const tr = `<tr>${td.repeat(cols)}</tr>`;
        run('insertHTML', `<table style="border-collapse:collapse;width:100%"><tbody>${tr.repeat(rows)}</tbody></table><p><br></p>`);
    };

    // HTML 원본 토글 — 돌아올 때 편집 영역에 다시 넣음 (서버가 저장 시 정제하고, 미리보기는 격리 iframe)
    const toggleSource = () => {
        if (source === null) {
            setSource(ref.current?.innerHTML ?? '');
        } else {
            if (ref.current) ref.current.innerHTML = source;
            setSource(null);
            emit();
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
        ['table', '표', <Table key="tbl" className="size-4" />],
        ['source', 'HTML 원본', <Code key="src" className="size-4" />],
    ] as const;
    const shownTools = TOOLS.filter(([tool]) => (tool === 'image' ? allowImage : tool === 'table' ? allowTable : tool === 'source' ? allowSource : true));
    const onTool = (tool: (typeof TOOLS)[number][0]) => {
        if (tool === 'bold') run('bold');
        else if (tool === 'h2' || tool === 'h3') run('formatBlock', tool);
        else if (tool === 'ul') run('insertUnorderedList');
        else if (tool === 'ol') run('insertOrderedList');
        else if (tool === 'link') addLink();
        else if (tool === 'table') addTable();
        else if (tool === 'source') toggleSource();
        else fileRef.current?.click();
    };

    return (
        <div className="flex flex-col gap-1 text-sm font-medium text-ink">
            <span>{label}</span>
            <div className="rounded-lg border border-line bg-white focus-within:border-primary">
                <div role="toolbar" aria-label={`${label} 서식`} className="flex flex-wrap gap-0.5 border-b border-line p-1">
                    {shownTools.map(([tool, name, icon]) => (
                        <button
                            key={name}
                            type="button"
                            aria-label={name}
                            title={name}
                            onMouseDown={e => e.preventDefault()} // 버튼을 눌러도 편집 영역 선택이 풀리지 않게
                            onClick={() => onTool(tool)}
                            // 원본 편집 중에는 원본 버튼만 사용 (서식 버튼은 편집 영역이 숨겨져 있어 동작 안 함)
                            disabled={uploading || (source !== null && tool !== 'source')}
                            aria-pressed={tool === 'source' ? source !== null : undefined}
                            className="rounded p-1.5 text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
                        >
                            {icon}
                        </button>
                    ))}
                    {uploading && <span className="self-center px-2 text-xs text-muted">이미지 올리는 중…</span>}
                </div>
                {source !== null && (
                    <textarea
                        aria-label={`${label} HTML 원본`}
                        value={source}
                        onChange={e => (setSource(e.target.value), onChange(e.target.value))} // 원본 편집 중에도 바깥 값 갱신(바로 저장해도 반영)
                        spellCheck={false}
                        className="min-h-48 w-full resize-y p-3 font-mono text-xs font-normal outline-none"
                    />
                )}
                <div
                    ref={ref}
                    hidden={source !== null}
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
