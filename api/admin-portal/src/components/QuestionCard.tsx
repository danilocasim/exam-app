import type { AdminQuestion } from '../services/api';

interface QuestionCardProps {
  question: AdminQuestion;
  onClick: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: '#f0f0f0', text: '#666' },
  PENDING: { bg: '#fff7e6', text: '#d48806' },
  APPROVED: { bg: '#f6ffed', text: '#389e0d' },
  ARCHIVED: { bg: '#fff1f0', text: '#cf1322' },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: '#52c41a',
  MEDIUM: '#faad14',
  HARD: '#f5222d',
};

/**
 * T096: Question card component with status badges
 */
export function QuestionCard({ question, onClick }: QuestionCardProps) {
  const statusStyle = STATUS_COLORS[question.status] || STATUS_COLORS.DRAFT;

  return (
    <div style={styles.card} onClick={onClick}>
      <div style={styles.header}>
        <span
          style={{
            ...styles.badge,
            background: statusStyle.bg,
            color: statusStyle.text,
          }}
        >
          {question.status}
        </span>
        <span
          style={{
            ...styles.badge,
            background: '#f5f5f5',
            color: DIFFICULTY_COLORS[question.difficulty] || '#666',
            fontWeight: 600,
          }}
        >
          {question.difficulty}
        </span>
        <span style={styles.domain}>{question.domain}</span>
        <span style={styles.type}>{question.type.replace(/_/g, ' ')}</span>
      </div>

      <p style={styles.text}>{question.text}</p>

      <div style={styles.footer}>
        <span style={styles.meta}>
          v{question.version} · {question.options.length} options ·{' '}
          {question.correctAnswers.length} correct
        </span>
        <span style={styles.meta}>
          {new Date(question.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: 6,
    padding: 16,
    cursor: 'pointer',
    border: '1px solid #e8e8e8',
    transition: 'box-shadow 0.2s',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  badge: {
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  domain: {
    fontSize: 12,
    color: '#666',
    marginLeft: 'auto',
  },
  type: {
    fontSize: 11,
    color: '#999',
    textTransform: 'lowercase',
  },
  text: {
    fontSize: 14,
    lineHeight: '1.5',
    color: '#333',
    margin: '8px 0',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    fontSize: 12,
    color: '#999',
  },
};
