import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { AdminQuestion, QuestionInput } from '../services/api';
import { useSelectedExamType } from '../components/Layout';
import { QuestionForm } from '../components/QuestionForm';

/**
 * T097: Question detail page with approve/archive/restore actions
 * Also handles creating new questions (when no :id param)
 */
export function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedExamType, examTypes } = useSelectedExamType();
  const [question, setQuestion] = useState<AdminQuestion | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [actionLoading, setActionLoading] = useState('');
  const [isEditing, setIsEditing] = useState(!id);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getQuestion(id)
      .then(setQuestion)
      .catch(() => navigate('/questions'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleCreate = useCallback(
    async (input: QuestionInput) => {
      await api.createQuestion(input);
      navigate('/questions');
    },
    [navigate],
  );

  const handleUpdate = useCallback(
    async (input: QuestionInput) => {
      if (!id) return;
      const updated = await api.updateQuestion(id, input);
      setQuestion(updated);
      setIsEditing(false);
    },
    [id],
  );

  const handleAction = useCallback(
    async (action: 'approve' | 'archive' | 'restore') => {
      if (!id) return;
      setActionLoading(action);
      try {
        const fns = {
          approve: api.approveQuestion,
          archive: api.archiveQuestion,
          restore: api.restoreQuestion,
        };
        const updated = await fns[action](id);
        setQuestion(updated);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setActionLoading('');
      }
    },
    [id],
  );

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
        Loading...
      </div>
    );
  }

  // Create mode
  if (!id) {
    return (
      <div>
        <h1 style={styles.title}>New Question</h1>
        <QuestionForm
          examTypes={examTypes}
          selectedExamType={selectedExamType}
          onSubmit={handleCreate}
          onCancel={() => navigate('/questions')}
          submitLabel="Create Question"
        />
      </div>
    );
  }

  // Edit mode
  if (isEditing && question) {
    return (
      <div>
        <h1 style={styles.title}>Edit Question</h1>
        <QuestionForm
          examTypes={examTypes}
          selectedExamType={selectedExamType}
          initialValues={{
            examTypeId: question.examTypeId,
            text: question.text,
            type: question.type as QuestionInput['type'],
            domain: question.domain,
            difficulty: question.difficulty as QuestionInput['difficulty'],
            options: question.options,
            correctAnswers: question.correctAnswers,
            explanation: question.explanation,
          }}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
          submitLabel="Save Changes"
        />
      </div>
    );
  }

  // Detail view
  if (!question) return null;

  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    DRAFT: { bg: '#f0f0f0', text: '#666' },
    PENDING: { bg: '#fff7e6', text: '#d48806' },
    APPROVED: { bg: '#f6ffed', text: '#389e0d' },
    ARCHIVED: { bg: '#fff1f0', text: '#cf1322' },
  };
  const sc = STATUS_COLORS[question.status] || STATUS_COLORS.DRAFT;

  return (
    <div>
      <div style={styles.headerRow}>
        <button onClick={() => navigate('/questions')} style={styles.backBtn}>
          ← Back
        </button>
        <div style={styles.headerActions}>
          {(question.status === 'DRAFT' || question.status === 'PENDING') && (
            <button onClick={() => setIsEditing(true)} style={styles.editBtn}>
              Edit
            </button>
          )}
          {question.status === 'PENDING' && (
            <button
              onClick={() => handleAction('approve')}
              disabled={!!actionLoading}
              style={styles.approveBtn}
            >
              {actionLoading === 'approve' ? 'Approving...' : '✓ Approve'}
            </button>
          )}
          {(question.status === 'APPROVED' ||
            question.status === 'PENDING' ||
            question.status === 'DRAFT') && (
            <button
              onClick={() => handleAction('archive')}
              disabled={!!actionLoading}
              style={styles.archiveBtn}
            >
              {actionLoading === 'archive' ? 'Archiving...' : 'Archive'}
            </button>
          )}
          {question.status === 'ARCHIVED' && (
            <button
              onClick={() => handleAction('restore')}
              disabled={!!actionLoading}
              style={styles.restoreBtn}
            >
              {actionLoading === 'restore' ? 'Restoring...' : 'Restore'}
            </button>
          )}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.statusRow}>
          <span style={{ ...styles.badge, background: sc.bg, color: sc.text }}>
            {question.status}
          </span>
          <span style={styles.meta}>v{question.version}</span>
          <span style={styles.meta}>{question.difficulty}</span>
          <span style={styles.meta}>{question.domain}</span>
          <span style={styles.meta}>{question.type.replace(/_/g, ' ')}</span>
        </div>

        <h2 style={styles.questionText}>{question.text}</h2>

        <div style={styles.optionsSection}>
          <h3 style={styles.sectionTitle}>Options</h3>
          {question.options.map((opt) => {
            const isCorrect = question.correctAnswers.includes(opt.id);
            return (
              <div
                key={opt.id}
                style={{
                  ...styles.option,
                  ...(isCorrect ? styles.correctOption : {}),
                }}
              >
                <span style={styles.optionId}>{opt.id}</span>
                <span>{opt.text}</span>
                {isCorrect && (
                  <span style={styles.correctBadge}>✓ Correct</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={styles.explanationSection}>
          <h3 style={styles.sectionTitle}>Explanation</h3>
          <p style={styles.explanation}>{question.explanation}</p>
        </div>

        <div style={styles.metaSection}>
          <div style={styles.metaItem}>
            <span style={styles.metaLabel}>Created by</span>
            <span>{question.createdBy?.name || '—'}</span>
          </div>
          <div style={styles.metaItem}>
            <span style={styles.metaLabel}>Created</span>
            <span>{new Date(question.createdAt).toLocaleString()}</span>
          </div>
          {question.approvedBy && (
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Approved by</span>
              <span>{question.approvedBy.name}</span>
            </div>
          )}
          {question.approvedAt && (
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Approved</span>
              <span>{new Date(question.approvedAt).toLocaleString()}</span>
            </div>
          )}
          {question.archivedAt && (
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Archived</span>
              <span>{new Date(question.archivedAt).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: 16,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#1677ff',
    cursor: 'pointer',
    fontSize: 14,
    padding: 0,
  },
  headerActions: {
    display: 'flex',
    gap: 8,
  },
  editBtn: {
    padding: '6px 16px',
    background: '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
  },
  approveBtn: {
    padding: '6px 16px',
    background: '#52c41a',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  archiveBtn: {
    padding: '6px 16px',
    background: '#fff',
    border: '1px solid #ff4d4f',
    color: '#ff4d4f',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
  },
  restoreBtn: {
    padding: '6px 16px',
    background: '#1677ff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  card: {
    background: '#fff',
    borderRadius: 6,
    padding: 24,
    border: '1px solid #e8e8e8',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  badge: {
    padding: '2px 10px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: 13,
    color: '#666',
  },
  questionText: {
    fontSize: 18,
    fontWeight: 600,
    lineHeight: '1.6',
    color: '#1a1a2e',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
    marginBottom: 8,
  },
  optionsSection: {
    marginBottom: 20,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 4,
    border: '1px solid #e8e8e8',
    marginBottom: 6,
    fontSize: 14,
  },
  correctOption: {
    background: '#f6ffed',
    borderColor: '#b7eb8f',
  },
  optionId: {
    fontWeight: 700,
    color: '#666',
    width: 18,
  },
  correctBadge: {
    marginLeft: 'auto',
    color: '#52c41a',
    fontSize: 12,
    fontWeight: 600,
  },
  explanationSection: {
    marginBottom: 20,
  },
  explanation: {
    fontSize: 14,
    lineHeight: '1.6',
    color: '#555',
    background: '#fafafa',
    padding: 12,
    borderRadius: 4,
  },
  metaSection: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    borderTop: '1px solid #f0f0f0',
    paddingTop: 16,
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontSize: 13,
  },
  metaLabel: {
    color: '#999',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
};
