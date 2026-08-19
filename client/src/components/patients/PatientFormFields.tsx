// =========================================================================
// TYPE-SAFE FIELD PRIMITIVES
// Small input components that make illegal states hard to represent in the
// UI layer itself: NumberField only emits numbers, YesNoField only emits
// YesNoUnknown, etc. Keeps PatientIntakeForm's state updates type-checked
// end to end instead of relying on casting raw input.value strings.
// =========================================================================

import type { YesNoUnknown } from '../../types/patient';

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  marginBottom: '6px',
  fontSize: '14px',
  color: '#333',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const fieldWrapStyle: React.CSSProperties = {
  marginBottom: '16px',
};

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={labelStyle}>{children}</label>;
}

export function FieldWrap({ children }: { children: React.ReactNode }) {
  return <div style={fieldWrapStyle}>{children}</div>;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <FieldWrap>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        style={inputStyle}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldWrap>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <FieldWrap>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        style={{ ...inputStyle, resize: 'vertical' }}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldWrap>
  );
}

/** Emits `number | null` only — never a raw string, never NaN.
 *  Empty input -> null (distinct from 0). */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <FieldWrap>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        style={inputStyle}
        value={value === null ? '' : value}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(null);
            return;
          }
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) {
            onChange(parsed);
          }
        }}
      />
    </FieldWrap>
  );
}

/** Digits-only text field for IDs / phone numbers — strips non-digit
 *  characters on every keystroke so the underlying value is always
 *  numeric-string clean, while still being stored as `string` to preserve
 *  leading zeros (a raw `number` would lose them). */
export function DigitsField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <FieldWrap>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        inputMode="numeric"
        style={inputStyle}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      />
    </FieldWrap>
  );
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FieldWrap>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="date"
        style={inputStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldWrap>
  );
}

/** Renders as a 3-way radio group; emits only YesNoUnknown. */
export function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: YesNoUnknown;
  onChange: (value: YesNoUnknown) => void;
}) {
  const options: { value: YesNoUnknown; text: string }[] = [
    { value: 'yes', text: 'כן' },
    { value: 'no', text: 'לא' },
    { value: 'unknown', text: 'לא ידוע' },
  ];
  return (
    <FieldWrap>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: 'flex', gap: '16px' }}>
        {options.map((opt) => (
          <label
            key={opt.value}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', cursor: 'pointer' }}
          >
            <input
              type="radio"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            {opt.text}
          </label>
        ))}
      </div>
    </FieldWrap>
  );
}

/** Generic type-safe single-select for any string-literal union `T`.
 *  `options` enforces that every rendered value is a valid `T` — there's
 *  no way to wire this up to emit a string outside the union. */
export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; text: string }[];
}) {
  return (
    <FieldWrap>
      <FieldLabel>{label}</FieldLabel>
      <select
        style={inputStyle}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.text}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
}
