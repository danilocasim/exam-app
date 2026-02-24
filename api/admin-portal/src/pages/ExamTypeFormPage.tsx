import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type {
  ExamType,
  ExamTypeDomainInput,
  CreateExamTypeInput,
  UpdateExamTypeInput,
} from '../services/api';
import { DomainEditor } from '../components/DomainEditor';
import { colors, radius } from '../theme';

interface FormState {
  id: string;
  name: string;
  displayName: string;
  description: string;
  passingScore: number;
  timeLimit: number;
  questionCount: number;
  domains: ExamTypeDomainInput[];
}

type ValidationErrors = Partial<Record<keyof FormState, string>>;

const ID_REGEX = /^[A-Za-z0-9-]+$/;

function validate(form: FormState, isEditMode: boolean): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!isEditMode) {
    if (!form.id.trim()) {
      errors.id = 'ID is required';
    } else if (!ID_REGEX.test(form.id)) {
      errors.id = 'ID must contain only letters, numbers, and hyphens';
    }
  }

  if (form.name.length < 3) {
    errors.name = 'Name must be at least 3 characters';
  }

  if (form.displayName.length < 2) {
    errors.displayName = 'Display name must be at least 2 characters';
  }

  if (form.passingScore < 0 || form.passingScore > 100) {
    errors.passingScore = 'Passing score must be between 0 and 100';
  }

  if (!Number.isInteger(form.timeLimit) || form.timeLimit < 1) {
    errors.timeLimit = 'Time limit must be a positive integer';
  }

  if (form.questionCount < 1 || form.questionCount > 500) {
    errors.questionCount = 'Question count must be between 1 and 500';
  }

  if (form.domains.length === 0) {
    errors.domains = 'At least one domain is required';
  } else {
    const totalWeight = form.domains.reduce((s, d) => s + (d.weight || 0), 0);
    if (totalWeight !== 100) {
      errors.domains = `Domain weights must sum to 100 (currently ${totalWeight})`;
    }
    const hasEmptyDomain = form.domains.some(
      (d) => !d.id.trim() || !d.name.trim(),
    );
    if (hasEmptyDomain) {
      errors.domains = errors.domains || 'All domains must have an ID and name';
    }
  }

  return errors;
}

const EMPTY_FORM: FormState = {
  id: '',
  name: '',
  displayName: '',
  description: '',
  passingScore: 70,
  timeLimit: 90,
  questionCount: 65,
  domains: [{ id: '', name: '', weight: 0, questionCount: 0 }],
};

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  fontSize: 14,
  color: colors.heading,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const errorInputStyle: React.CSSProperties = {
  ...inputStyle,
  border: `1px solid ${colors.error}`,
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  fontWeight: 500,
  color: colors.muted,
  flex: 1,
};

const fieldErrorStyle: React.CSSProperties = {
  fontSize: 11,
  color: colors.errorText,
  marginTop: 2,
};

export function ExamTypeFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const validationErrors = useMemo(
    () => validate(form, isEditMode),
    [form, isEditMode],
  );
  const hasErrors = Object.keys(validationErrors).length > 0;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getExamTypes()
      .then((types: ExamType[]) => {
        const found = types.find((t) => t.id === id);
        if (!found) {
          navigate('/exam-types');
          return;
        }
        setForm({
          id: found.id,
          name: found.name,
          displayName: found.displayName,
          description: found.description || '',
          passingScore: found.passingScore,
          timeLimit: found.timeLimit,
          questionCount: found.questionCount,
          domains: found.domains.map((d) => ({
            id: d.id,
            name: d.name,
            weight: d.weight,
            questionCount: d.questionCount,
          })),
        });
      })
      .catch(() => navigate('/exam-types'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setTouched(true);

      if (hasErrors) return;

      setError('');
      setSaving(true);

      try {
        if (isEditMode) {
          const input: UpdateExamTypeInput = {
            name: form.name,
            displayName: form.displayName,
            description: form.description || undefined,
            domains: form.domains,
            passingScore: form.passingScore,
            timeLimit: form.timeLimit,
            questionCount: form.questionCount,
          };
          await api.updateExamType(id!, input);
        } else {
          const input: CreateExamTypeInput = {
            id: form.id,
            name: form.name,
            displayName: form.displayName,
            description: form.description || undefined,
            domains: form.domains,
            passingScore: form.passingScore,
            timeLimit: form.timeLimit,
            questionCount: form.questionCount,
          };
          await api.createExamType(input);
        }
        navigate('/exam-types');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    },
    [form, isEditMode, id, navigate, hasErrors],
  );

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: colors.subtle }}>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => navigate('/exam-types')}
          style={{
            background: 'none',
            border: 'none',
            color: colors.primary,
            cursor: 'pointer',
            fontSize: 14,
            padding: 0,
            fontWeight: 500,
          }}
        >
          {'\u2190'} Back to Exam Types
        </button>
      </div>

      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: colors.heading,
          marginBottom: 16,
        }}
      >
        {isEditMode ? 'Edit Exam Type' : 'Create Exam Type'}
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          background: colors.surfaceRaised,
          padding: 24,
          borderRadius: radius.md,
          border: `1px solid ${colors.border}`,
        }}
      >
        {error && (
          <div
            style={{
              background: colors.errorMuted,
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: radius.sm,
              padding: '10px 14px',
              color: colors.errorText,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Row 1: ID + Name */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={labelStyle}>
            ID
            {isEditMode && (
              <span
                style={{ fontSize: 11, color: colors.subtle, fontWeight: 400 }}
              >
                (read-only)
              </span>
            )}
            <input
              type="text"
              value={form.id}
              onChange={(e) => updateField('id', e.target.value)}
              readOnly={isEditMode}
              placeholder="e.g. CLF-C02"
              required
              style={{
                ...(touched && validationErrors.id
                  ? errorInputStyle
                  : inputStyle),
                ...(isEditMode
                  ? {
                      opacity: 0.6,
                      cursor: 'not-allowed',
                      fontFamily: 'monospace',
                    }
                  : {}),
              }}
            />
            {touched && validationErrors.id && (
              <span style={fieldErrorStyle}>{validationErrors.id}</span>
            )}
          </label>
          <label style={labelStyle}>
            Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. AWS Certified Cloud Practitioner"
              required
              style={
                touched && validationErrors.name ? errorInputStyle : inputStyle
              }
            />
            {touched && validationErrors.name && (
              <span style={fieldErrorStyle}>{validationErrors.name}</span>
            )}
          </label>
        </div>

        {/* Row 2: Display Name */}
        <label style={labelStyle}>
          Display Name
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => updateField('displayName', e.target.value)}
            placeholder="e.g. AWS Cloud Practitioner (CLF-C02)"
            required
            style={
              touched && validationErrors.displayName
                ? errorInputStyle
                : inputStyle
            }
          />
          {touched && validationErrors.displayName && (
            <span style={fieldErrorStyle}>{validationErrors.displayName}</span>
          )}
        </label>

        {/* Row 3: Description */}
        <label style={labelStyle}>
          Description
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Brief description of the exam type"
            style={{
              ...inputStyle,
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: 80,
            }}
          />
        </label>

        {/* Row 4: Numeric fields */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={labelStyle}>
            Passing Score (%)
            <input
              type="number"
              min={0}
              max={100}
              value={form.passingScore}
              onChange={(e) =>
                updateField('passingScore', Number(e.target.value) || 0)
              }
              required
              style={
                touched && validationErrors.passingScore
                  ? errorInputStyle
                  : inputStyle
              }
            />
            {touched && validationErrors.passingScore && (
              <span style={fieldErrorStyle}>
                {validationErrors.passingScore}
              </span>
            )}
          </label>
          <label style={labelStyle}>
            Time Limit (min)
            <input
              type="number"
              min={1}
              value={form.timeLimit}
              onChange={(e) =>
                updateField('timeLimit', Number(e.target.value) || 0)
              }
              required
              style={
                touched && validationErrors.timeLimit
                  ? errorInputStyle
                  : inputStyle
              }
            />
            {touched && validationErrors.timeLimit && (
              <span style={fieldErrorStyle}>{validationErrors.timeLimit}</span>
            )}
          </label>
          <label style={labelStyle}>
            Question Count
            <input
              type="number"
              min={1}
              value={form.questionCount}
              onChange={(e) =>
                updateField('questionCount', Number(e.target.value) || 0)
              }
              required
              style={
                touched && validationErrors.questionCount
                  ? errorInputStyle
                  : inputStyle
              }
            />
            {touched && validationErrors.questionCount && (
              <span style={fieldErrorStyle}>
                {validationErrors.questionCount}
              </span>
            )}
          </label>
        </div>

        {/* Domains */}
        <DomainEditor
          domains={form.domains}
          onChange={(domains) => updateField('domains', domains)}
        />
        {touched && validationErrors.domains && (
          <div style={{ ...fieldErrorStyle, marginTop: -10 }}>
            {validationErrors.domains}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/exam-types')}
            style={{
              padding: '9px 22px',
              background: 'transparent',
              border: `1px solid ${colors.border}`,
              color: colors.body,
              borderRadius: radius.sm,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || (touched && hasErrors)}
            style={{
              padding: '9px 22px',
              background: colors.primary,
              color: '#1A1A2E',
              border: 'none',
              borderRadius: radius.sm,
              cursor:
                saving || (touched && hasErrors) ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 700,
              opacity: saving || (touched && hasErrors) ? 0.5 : 1,
            }}
          >
            {saving
              ? 'Saving...'
              : isEditMode
                ? 'Save Changes'
                : 'Create Exam Type'}
          </button>
        </div>
      </form>
    </div>
  );
}
