import type { ExamType } from '../services/api';
import { colors, radius } from '../theme';

interface Props {
  examTypes: ExamType[];
  selected: string;
  onChange: (id: string) => void;
}

export function ExamTypeSwitcher({ examTypes, selected, onChange }: Props) {
  if (examTypes.length === 0) {
    return (
      <div style={{ fontSize: 12, color: colors.subtle, padding: '8px 0' }}>
        Loading...
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: colors.subtle,
          fontWeight: 600,
        }}
      >
        Exam Type
      </label>
      <select
        title="Select Exam Type"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: colors.surfaceRaised,
          color: colors.body,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.sm,
          padding: '8px 10px',
          fontSize: 13,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {examTypes.map((et) => (
          <option key={et.id} value={et.id}>
            {et.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
