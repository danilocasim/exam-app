import { useState, useCallback, useEffect } from 'react';
import type { QuestionInput, ExamType } from '../services/api';
import { colors, radius } from '../theme';

interface Props {
  examTypes: ExamType[];
  selectedExamType: string;
  initialValues?: Partial<QuestionInput>;
  onSubmit: (input: QuestionInput) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function QuestionForm({
  examTypes,
  selectedExamType,
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}: Props) {
  const examType = examTypes.find(
    (et) => et.id === (initialValues?.examTypeId || selectedExamType),
  );
  const domains = examType?.domains || [];

  const [formData, setFormData] = useState<QuestionInput>({
    examTypeId: initialValues?.examTypeId || selectedExamType,
    text: initialValues?.text || '',
    type: initialValues?.type || 'SINGLE_CHOICE',
    domain: initialValues?.domain || domains[0]?.id || '',
    difficulty: initialValues?.difficulty || 'MEDIUM',
    options: initialValues?.options || [
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' },
    ],
    correctAnswers: initialValues?.correctAnswers || [],
    explanation: initialValues?.explanation || '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync examTypeId and domain when selectedExamType loads asynchronously
  useEffect(() => {
    if (
      !initialValues?.examTypeId &&
      selectedExamType &&
      !formData.examTypeId
    ) {
      const et = examTypes.find((t) => t.id === selectedExamType);
      const firstDomain = et?.domains?.[0]?.id || '';
      setFormData((prev) => ({
        ...prev,
        examTypeId: selectedExamType,
        domain: prev.domain || firstDomain,
      }));
    }
  }, [
    selectedExamType,
    examTypes,
    initialValues?.examTypeId,
    formData.examTypeId,
  ]);

  const updateField = <K extends keyof QuestionInput>(
    key: K,
    value: QuestionInput[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };
  const updateOption = (index: number, text: string) => {
    const opts = [...formData.options];
    opts[index] = { ...opts[index], text };
    updateField('options', opts);
  };
  const addOption = () => {
    const nextId = String.fromCharCode(65 + formData.options.length);
    updateField('options', [...formData.options, { id: nextId, text: '' }]);
  };
  const removeOption = (index: number) => {
    if (formData.options.length <= 2) return;
    const removed = formData.options[index];
    updateField(
      'options',
      formData.options.filter((_, i) => i !== index),
    );
    updateField(
      'correctAnswers',
      formData.correctAnswers.filter((a) => a !== removed.id),
    );
  };
  const toggleCorrect = (optionId: string) => {
    const answers = formData.correctAnswers.includes(optionId)
      ? formData.correctAnswers.filter((a) => a !== optionId)
      : [...formData.correctAnswers, optionId];
    updateField('correctAnswers', answers);
  };
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        await onSubmit(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setLoading(false);
      }
    },
    [formData, onSubmit],
  );

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px',
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    fontSize: 14,
    color: colors.heading,
    outline: 'none',
    width: '100%',
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
    color: colors.muted,
    flex: 1,
  };

  return (
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

      <div
        className="cp-form-row"
        style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}
      >
        <label style={labelStyle}>
          Exam Type
          <select
            value={formData.examTypeId}
            onChange={(e) => updateField('examTypeId', e.target.value)}
            style={selectStyle}
          >
            {examTypes.map((et) => (
              <option key={et.id} value={et.id}>
                {et.displayName}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Type
          <select
            value={formData.type}
            onChange={(e) =>
              updateField('type', e.target.value as QuestionInput['type'])
            }
            style={selectStyle}
          >
            <option value="SINGLE_CHOICE">Single Choice</option>
            <option value="MULTIPLE_CHOICE">Multiple Choice</option>
            <option value="TRUE_FALSE">True / False</option>
          </select>
        </label>
      </div>

      <div
        className="cp-form-row"
        style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}
      >
        <label style={labelStyle}>
          Domain
          <select
            value={formData.domain}
            onChange={(e) => updateField('domain', e.target.value)}
            style={selectStyle}
          >
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Difficulty
          <select
            value={formData.difficulty}
            onChange={(e) =>
              updateField(
                'difficulty',
                e.target.value as QuestionInput['difficulty'],
              )
            }
            style={selectStyle}
          >
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </label>
      </div>

      <label style={labelStyle}>
        Question Text
        <textarea
          value={formData.text}
          onChange={(e) => updateField('text', e.target.value)}
          style={{
            ...inputStyle,
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: 80,
          }}
          required
          minLength={20}
        />
        <span
          style={{ fontSize: 11, color: colors.subtle, alignSelf: 'flex-end' }}
        >
          {formData.text.length} chars
        </span>
      </label>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: colors.muted }}>
            Options (check correct)
          </span>
          <button
            type="button"
            onClick={addOption}
            style={{
              background: 'none',
              border: 'none',
              color: colors.primary,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            + Add
          </button>
        </div>
        {formData.options.map((opt, i) => (
          <div
            key={opt.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <input
              title={`Option ${opt.id}`}
              type="checkbox"
              checked={formData.correctAnswers.includes(opt.id)}
              onChange={() => toggleCorrect(opt.id)}
              style={{ accentColor: colors.primary }}
            />
            <span
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: colors.muted,
                width: 18,
              }}
            >
              {opt.id}
            </span>
            <input
              type="text"
              value={opt.text}
              onChange={(e) => updateOption(i, e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              placeholder={`Option ${opt.id}`}
              required
            />
            {formData.options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.error,
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                &#x2715;
              </button>
            )}
          </div>
        ))}
      </div>

      <label style={labelStyle}>
        Explanation
        <textarea
          value={formData.explanation}
          onChange={(e) => updateField('explanation', e.target.value)}
          style={{
            ...inputStyle,
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: 100,
          }}
          required
          minLength={50}
        />
        <span
          style={{ fontSize: 11, color: colors.subtle, alignSelf: 'flex-end' }}
        >
          {formData.explanation.length} chars
        </span>
      </label>

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
          onClick={onCancel}
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
          disabled={loading}
          style={{
            padding: '9px 22px',
            background: colors.primary,
            color: '#1A1A2E',
            border: 'none',
            borderRadius: radius.sm,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {loading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
