import { useState, useCallback } from 'react';
import type { QuestionInput, ExamType } from '../services/api';

interface QuestionFormProps {
  examTypes: ExamType[];
  selectedExamType: string;
  initialValues?: Partial<QuestionInput>;
  onSubmit: (input: QuestionInput) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

/**
 * T095: Question form component for create/edit
 */
export function QuestionForm({
  examTypes,
  selectedExamType,
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}: QuestionFormProps) {
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
    const nextId = String.fromCharCode(65 + formData.options.length); // A, B, C...
    updateField('options', [...formData.options, { id: nextId, text: '' }]);
  };

  const removeOption = (index: number) => {
    if (formData.options.length <= 2) return;
    const opts = formData.options.filter((_, i) => i !== index);
    const removed = formData.options[index];
    updateField('options', opts);
    updateField(
      'correctAnswers',
      formData.correctAnswers.filter((a) => a !== removed.id),
    );
  };

  const toggleCorrectAnswer = (optionId: string) => {
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

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.row}>
        <label style={styles.label}>
          Exam Type
          <select
            value={formData.examTypeId}
            onChange={(e) => updateField('examTypeId', e.target.value)}
            style={styles.select}
          >
            {examTypes.map((et) => (
              <option key={et.id} value={et.id}>
                {et.displayName}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Type
          <select
            value={formData.type}
            onChange={(e) =>
              updateField('type', e.target.value as QuestionInput['type'])
            }
            style={styles.select}
          >
            <option value="SINGLE_CHOICE">Single Choice</option>
            <option value="MULTIPLE_CHOICE">Multiple Choice</option>
            <option value="TRUE_FALSE">True / False</option>
          </select>
        </label>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>
          Domain
          <select
            value={formData.domain}
            onChange={(e) => updateField('domain', e.target.value)}
            style={styles.select}
          >
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Difficulty
          <select
            value={formData.difficulty}
            onChange={(e) =>
              updateField(
                'difficulty',
                e.target.value as QuestionInput['difficulty'],
              )
            }
            style={styles.select}
          >
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </label>
      </div>

      <label style={styles.label}>
        Question Text (min 20 characters)
        <textarea
          value={formData.text}
          onChange={(e) => updateField('text', e.target.value)}
          style={styles.textarea}
          rows={3}
          required
          minLength={20}
        />
        <span style={styles.charCount}>{formData.text.length} characters</span>
      </label>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            Options (check correct answers)
          </span>
          <button type="button" onClick={addOption} style={styles.addBtn}>
            + Add Option
          </button>
        </div>

        {formData.options.map((opt, i) => (
          <div key={opt.id} style={styles.optionRow}>
            <input
              type="checkbox"
              checked={formData.correctAnswers.includes(opt.id)}
              onChange={() => toggleCorrectAnswer(opt.id)}
            />
            <span style={styles.optionId}>{opt.id}</span>
            <input
              type="text"
              value={opt.text}
              onChange={(e) => updateOption(i, e.target.value)}
              style={styles.optionInput}
              placeholder={`Option ${opt.id}`}
              required
            />
            {formData.options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                style={styles.removeBtn}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <label style={styles.label}>
        Explanation (min 50 characters)
        <textarea
          value={formData.explanation}
          onChange={(e) => updateField('explanation', e.target.value)}
          style={styles.textarea}
          rows={4}
          required
          minLength={50}
        />
        <span style={styles.charCount}>
          {formData.explanation.length} characters
        </span>
      </label>

      <div style={styles.actions}>
        <button type="button" onClick={onCancel} style={styles.cancelBtn}>
          Cancel
        </button>
        <button type="submit" disabled={loading} style={styles.submitBtn}>
          {loading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    background: '#fff',
    padding: 24,
    borderRadius: 6,
    border: '1px solid #e8e8e8',
  },
  error: {
    background: '#fff2f0',
    border: '1px solid #ffccc7',
    borderRadius: 4,
    padding: '8px 12px',
    color: '#cf1322',
    fontSize: 13,
  },
  row: {
    display: 'flex',
    gap: 16,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 13,
    fontWeight: 500,
    color: '#333',
    flex: 1,
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    fontSize: 14,
  },
  textarea: {
    padding: '8px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  charCount: {
    fontSize: 11,
    color: '#999',
    alignSelf: 'flex-end',
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  optionId: {
    fontWeight: 600,
    fontSize: 13,
    color: '#666',
    width: 16,
  },
  optionInput: {
    flex: 1,
    padding: '6px 10px',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    fontSize: 14,
  },
  addBtn: {
    background: 'none',
    border: 'none',
    color: '#1677ff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#cf1322',
    cursor: 'pointer',
    fontSize: 14,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    padding: '8px 20px',
    background: '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
  },
  submitBtn: {
    padding: '8px 20px',
    background: '#1677ff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
};
