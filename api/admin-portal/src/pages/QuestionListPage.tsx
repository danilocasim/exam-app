import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { AdminQuestion, QuestionSet } from '../services/api';
import { useSelectedExamType } from '../components/Layout';
import { QuestionCard } from '../components/QuestionCard';
import { colors, radius } from '../theme';

export function QuestionListPage() {
  const navigate = useNavigate();
  const { selectedExamType, examTypes } = useSelectedExamType();
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [domain, setDomain] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [setFilter, setSetFilter] = useState('');
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [approving, setApproving] = useState(false);
  const currentExamType = examTypes.find((et) => et.id === selectedExamType);
  const domains = currentExamType?.domains || [];

  // Fetch question sets for the filter dropdown
  useEffect(() => {
    if (!selectedExamType) return;
    api
      .getQuestionSets(selectedExamType)
      .then(setQuestionSets)
      .catch(() => setQuestionSets([]));
  }, [selectedExamType]);

  const fetchQuestions = useCallback(async () => {
    if (!selectedExamType) return;
    setLoading(true);
    try {
      const data = await api.getQuestions({
        examTypeId: selectedExamType,
        status: status || undefined,
        domain: domain || undefined,
        difficulty: difficulty || undefined,
        set: setFilter !== '' ? setFilter : undefined,
        page,
        limit: 20,
      });
      setQuestions(data.questions);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [selectedExamType, status, domain, difficulty, setFilter, page]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);
  useEffect(() => {
    setPage(1);
  }, [selectedExamType, status, domain, difficulty, setFilter]);

  const pendingOrDraftCount = questions.filter(
    (q) => q.status === 'DRAFT' || q.status === 'PENDING',
  ).length;

  const handleBulkApprove = useCallback(async () => {
    if (!selectedExamType) return;
    const msg =
      domain || difficulty || setFilter
        ? 'Approve all DRAFT and PENDING questions matching the current filters?'
        : 'Approve ALL DRAFT and PENDING questions for this exam type?';
    if (!window.confirm(msg)) return;
    setApproving(true);
    try {
      const result = await api.bulkApproveQuestions({
        examTypeId: selectedExamType,
        domain: domain || undefined,
        difficulty: difficulty || undefined,
        set: setFilter || undefined,
      });
      alert(
        `${result.approved} question${result.approved !== 1 ? 's' : ''} approved.`,
      );
      await fetchQuestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bulk approve failed');
    } finally {
      setApproving(false);
    }
  }, [selectedExamType, domain, difficulty, setFilter, fetchQuestions]);

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    fontSize: 13,
    color: colors.body,
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: colors.heading,
            margin: 0,
          }}
        >
          Questions
        </h1>
        <button
          onClick={() => navigate('/questions/new')}
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
          + New Question
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        <select
          title="Select Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={selectStyle}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          title="Select Domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          style={selectStyle}
        >
          <option value="">All Domains</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          title="Select Difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          style={selectStyle}
        >
          <option value="">All Difficulties</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
        <select
          title="Select Set"
          value={setFilter}
          onChange={(e) => setSetFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="">All Sets</option>
          <option value="__none__">No Set</option>
          {questionSets.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
              {s.archivedAt ? ' (archived)' : ''}
            </option>
          ))}
        </select>
        <span
          style={{ fontSize: 13, color: colors.subtle, marginLeft: 'auto' }}
        >
          {total} question{total !== 1 ? 's' : ''}
        </span>
        {pendingOrDraftCount > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={approving}
            style={{
              padding: '7px 16px',
              background: '#22c55e',
              color: '#fff',
              border: 'none',
              borderRadius: radius.sm,
              cursor: approving ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              opacity: approving ? 0.6 : 1,
            }}
          >
            {approving ? 'Approving…' : '✓ Approve All'}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: colors.subtle }}>
          Loading...
        </div>
      ) : questions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: colors.subtle }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{'\uD83D\uDCDD'}</div>
          <p style={{ marginBottom: 8 }}>No questions found</p>
          <button
            onClick={() => navigate('/questions/new')}
            style={{
              background: 'none',
              border: 'none',
              color: colors.primary,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Create one
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              onClick={() => navigate(`/questions/${q.id}`)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
            marginTop: 24,
          }}
        >
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            style={{ ...selectStyle, opacity: page <= 1 ? 0.4 : 1 }}
          >
            {'\u2190'} Prev
          </button>
          <span style={{ fontSize: 13, color: colors.subtle }}>
            Page {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{ ...selectStyle, opacity: page >= totalPages ? 0.4 : 1 }}
          >
            Next {'\u2192'}
          </button>
        </div>
      )}
    </div>
  );
}
