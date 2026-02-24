import type { ExamTypeDomainInput } from '../services/api';
import { colors, radius } from '../theme';

interface Props {
  domains: ExamTypeDomainInput[];
  onChange: (domains: ExamTypeDomainInput[]) => void;
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  fontSize: 13,
  color: colors.body,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const numberInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: 80,
  textAlign: 'center',
};

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: 'none',
  borderRadius: radius.sm,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.4,
};

export function DomainEditor({ domains, onChange }: Props) {
  const totalWeight = domains.reduce((sum, d) => sum + (d.weight || 0), 0);
  const isWeightValid = totalWeight === 100;

  const updateDomain = (
    index: number,
    field: keyof ExamTypeDomainInput,
    value: string | number,
  ) => {
    const updated = domains.map((d, i) =>
      i === index ? { ...d, [field]: value } : d,
    );
    onChange(updated);
  };

  const addDomain = () => {
    onChange([...domains, { id: '', name: '', weight: 0, questionCount: 0 }]);
  };

  const removeDomain = (index: number) => {
    if (domains.length <= 1) return;
    if (
      !window.confirm(
        `Remove domain "${domains[index].name || domains[index].id || `#${index + 1}`}"?`,
      )
    ) {
      return;
    }
    onChange(domains.filter((_, i) => i !== index));
  };

  const moveDomain = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= domains.length) return;
    const updated = [...domains];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 600, color: colors.heading }}>
          Domains
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: isWeightValid ? colors.successText : colors.warningText,
              background: isWeightValid
                ? colors.successMuted
                : colors.warningMuted,
              padding: '2px 8px',
              borderRadius: radius.sm,
            }}
          >
            Weight: {totalWeight}/100
          </span>
          <button
            type="button"
            onClick={addDomain}
            style={{
              ...smallBtnStyle,
              background: colors.primaryMuted,
              color: colors.primaryText,
            }}
          >
            + Add Domain
          </button>
        </div>
      </div>

      {domains.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 24,
            color: colors.subtle,
            fontSize: 13,
            background: colors.surface,
            borderRadius: radius.md,
            border: `1px dashed ${colors.border}`,
          }}
        >
          No domains added. Click "+ Add Domain" to begin.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Header row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '50px 1fr 1fr 80px 80px 80px',
              gap: 8,
              alignItems: 'center',
              padding: '0 4px',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: colors.subtle,
                textAlign: 'center',
              }}
            >
              Order
            </span>
            <span style={{ fontSize: 11, color: colors.subtle }}>ID</span>
            <span style={{ fontSize: 11, color: colors.subtle }}>Name</span>
            <span
              style={{
                fontSize: 11,
                color: colors.subtle,
                textAlign: 'center',
              }}
            >
              Weight
            </span>
            <span
              style={{
                fontSize: 11,
                color: colors.subtle,
                textAlign: 'center',
              }}
            >
              Q. Count
            </span>
            <span />
          </div>

          {domains.map((domain, index) => (
            <div
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 1fr 80px 80px 80px',
                gap: 8,
                alignItems: 'center',
                background: colors.surfaceRaised,
                borderRadius: radius.sm,
                padding: '8px 4px',
                border: `1px solid ${colors.border}`,
              }}
            >
              {/* Reorder buttons */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveDomain(index, -1)}
                  style={{
                    ...smallBtnStyle,
                    padding: '1px 6px',
                    background: 'transparent',
                    color: index === 0 ? colors.subtle : colors.body,
                    cursor: index === 0 ? 'default' : 'pointer',
                    fontSize: 11,
                  }}
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={index === domains.length - 1}
                  onClick={() => moveDomain(index, 1)}
                  style={{
                    ...smallBtnStyle,
                    padding: '1px 6px',
                    background: 'transparent',
                    color:
                      index === domains.length - 1
                        ? colors.subtle
                        : colors.body,
                    cursor:
                      index === domains.length - 1 ? 'default' : 'pointer',
                    fontSize: 11,
                  }}
                  title="Move down"
                >
                  ▼
                </button>
              </div>

              {/* ID */}
              <input
                type="text"
                placeholder="e.g. cloud-concepts"
                value={domain.id}
                onChange={(e) => updateDomain(index, 'id', e.target.value)}
                style={inputStyle}
              />

              {/* Name */}
              <input
                type="text"
                placeholder="e.g. Cloud Concepts"
                value={domain.name}
                onChange={(e) => updateDomain(index, 'name', e.target.value)}
                style={inputStyle}
              />

              {/* Weight */}
              <input
                type="number"
                min={0}
                max={100}
                value={domain.weight}
                onChange={(e) =>
                  updateDomain(index, 'weight', Number(e.target.value) || 0)
                }
                style={numberInputStyle}
              />

              {/* Question Count */}
              <input
                type="number"
                min={0}
                value={domain.questionCount}
                onChange={(e) =>
                  updateDomain(
                    index,
                    'questionCount',
                    Number(e.target.value) || 0,
                  )
                }
                style={numberInputStyle}
              />

              {/* Remove */}
              <button
                type="button"
                disabled={domains.length <= 1}
                onClick={() => removeDomain(index)}
                style={{
                  ...smallBtnStyle,
                  background: colors.errorMuted,
                  color: colors.errorText,
                  opacity: domains.length <= 1 ? 0.4 : 1,
                  cursor: domains.length <= 1 ? 'default' : 'pointer',
                }}
                title="Remove domain"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {!isWeightValid && domains.length > 0 && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: colors.warningText,
            fontWeight: 500,
          }}
        >
          ⚠ Domain weights must sum to exactly 100 (currently {totalWeight})
        </div>
      )}
    </div>
  );
}
