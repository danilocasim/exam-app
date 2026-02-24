import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { ExamType } from '../services/api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { colors, radius } from '../theme';

export function ExamTypeListPage() {
  const navigate = useNavigate();
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ExamType | null>(null);

  const fetchExamTypes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getExamTypes();
      setExamTypes(data);
    } catch {
      /* handled by api interceptor */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExamTypes();
  }, [fetchExamTypes]);

  const handleToggle = async (et: ExamType) => {
    setConfirmTarget(et);
  };

  const executeToggle = async () => {
    if (!confirmTarget) return;
    setTogglingId(confirmTarget.id);
    try {
      const updated = await api.toggleExamType(confirmTarget.id);
      setExamTypes((prev) =>
        prev.map((et) => (et.id === updated.id ? updated : et)),
      );
    } catch {
      /* error shown by api interceptor */
    } finally {
      setTogglingId(null);
      setConfirmTarget(null);
    }
  };

  const cellStyle: React.CSSProperties = {
    padding: '12px 14px',
    borderBottom: `1px solid ${colors.border}`,
    fontSize: 13,
    color: colors.body,
    whiteSpace: 'nowrap',
  };

  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 600,
    color: colors.heading,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    background: colors.surface,
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
          Exam Types
        </h1>
        <button
          onClick={() => navigate('/exam-types/new')}
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
          + Create New
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: colors.subtle }}>
          Loading...
        </div>
      ) : examTypes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: colors.subtle }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{'\uD83D\uDCCB'}</div>
          <p style={{ marginBottom: 8 }}>No exam types found</p>
          <button
            onClick={() => navigate('/exam-types/new')}
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
        <div
          style={{
            background: colors.surfaceRaised,
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 700,
              }}
            >
              <thead>
                <tr>
                  <th style={{ ...headerCellStyle, textAlign: 'left' }}>ID</th>
                  <th style={{ ...headerCellStyle, textAlign: 'left' }}>
                    Display Name
                  </th>
                  <th style={{ ...headerCellStyle, textAlign: 'center' }}>
                    Questions
                  </th>
                  <th style={{ ...headerCellStyle, textAlign: 'center' }}>
                    Passing %
                  </th>
                  <th style={{ ...headerCellStyle, textAlign: 'center' }}>
                    Time (min)
                  </th>
                  <th style={{ ...headerCellStyle, textAlign: 'center' }}>
                    Domains
                  </th>
                  <th style={{ ...headerCellStyle, textAlign: 'center' }}>
                    Status
                  </th>
                  <th style={{ ...headerCellStyle, textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {examTypes.map((et) => (
                  <tr
                    key={et.id}
                    style={{ transition: 'background 0.15s' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = colors.surfaceHover)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <td
                      style={{
                        ...cellStyle,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    >
                      {et.id}
                    </td>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 600, color: colors.heading }}>
                        {et.displayName}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: colors.subtle,
                          marginTop: 2,
                        }}
                      >
                        {et.name}
                      </div>
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      {et.questionCount}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      {et.passingScore}%
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      {et.timeLimit}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      {et.domains.length}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: radius.sm,
                          fontSize: 12,
                          fontWeight: 600,
                          background: et.isActive
                            ? colors.successMuted
                            : colors.errorMuted,
                          color: et.isActive
                            ? colors.successText
                            : colors.errorText,
                        }}
                      >
                        {et.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <button
                          onClick={() => navigate(`/exam-types/${et.id}`)}
                          style={{
                            padding: '5px 14px',
                            background: colors.primaryMuted,
                            color: colors.primaryText,
                            border: 'none',
                            borderRadius: radius.sm,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          Edit
                        </button>
                        <button
                          disabled={togglingId === et.id}
                          onClick={() => handleToggle(et)}
                          style={{
                            padding: '5px 14px',
                            background: et.isActive
                              ? colors.errorMuted
                              : colors.successMuted,
                            color: et.isActive
                              ? colors.errorText
                              : colors.successText,
                            border: 'none',
                            borderRadius: radius.sm,
                            cursor: togglingId === et.id ? 'wait' : 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            opacity: togglingId === et.id ? 0.5 : 1,
                          }}
                        >
                          {togglingId === et.id
                            ? '...'
                            : et.isActive
                              ? 'Deactivate'
                              : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          fontSize: 13,
          color: colors.subtle,
          textAlign: 'right',
        }}
      >
        {examTypes.length} exam type{examTypes.length !== 1 ? 's' : ''}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title={
          confirmTarget?.isActive
            ? 'Deactivate Exam Type'
            : 'Reactivate Exam Type'
        }
        message={
          confirmTarget?.isActive
            ? 'Deactivating this exam type will prevent mobile apps from receiving new questions. Existing questions remain accessible. Continue?'
            : 'Reactivating this exam type will make it available to mobile apps again. Continue?'
        }
        confirmLabel={confirmTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        variant={confirmTarget?.isActive ? 'danger' : 'info'}
        loading={!!togglingId}
        onConfirm={executeToggle}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
