type Option = { value: string; label: string };
type Props = { label: string; name: string; value: string; options: Option[]; onChange: (value: string) => void; error?: string };

// 라디오 묶음 — fieldset/legend로 화면 낭독기에 그룹 이름 전달, 오류는 aria-describedby
export function RadioGroup({ label, name, value, options, onChange, error }: Props) {
    const errorId = `${name}-error`;
    return (
        <fieldset aria-describedby={error ? errorId : undefined} className="flex flex-col gap-1 text-sm font-medium text-ink">
            <legend className="mb-1">{label}</legend>
            <div className="flex flex-wrap gap-2">
                {options.map(o => (
                    <label
                        key={o.value}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                            value === o.value ? 'border-primary bg-primary-soft font-bold text-primary' : 'border-line bg-white'
                        }`}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={o.value}
                            checked={value === o.value}
                            onChange={() => onChange(o.value)}
                            className="sr-only"
                        />
                        {o.label}
                    </label>
                ))}
            </div>
            {error && (
                <span id={errorId} className="text-xs font-normal text-rejected-fg">
                    {error}
                </span>
            )}
        </fieldset>
    );
}
