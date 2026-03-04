import { useState, useEffect, useCallback } from 'react';
import {
  api,
  type QuestionSet,
  type CreateQuestionSetInput,
} from '../services/api';
import { useSelectedExamType } from '../components/Layout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { colors, radius, font } from '../theme';

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function QuestionSetsPage() {
  const { selectedExamType } = useSelectedExamType();
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSet, setEditingSet] = useState<QuestionSet | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<QuestionSet | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSets = useCallback(async () => {
    if (!selectedExamType) return;
    setLoading(true);
    try {
      const data = await api.getQuestionSets(selectedExamType, true);
      setSets(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sets');
    } finally {
      setLoading(false);
    }
  }, [selectedExamType]);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  const handleCreate = useCallback(
    async (input: CreateQuestionSetInput) => {
      if (!selectedExamType) return;
      await api.createQuestionSet(selectedExamType, input);
      setShowForm(false);
      await fetchSets();
    },
    [selectedExamType, fetchSets],
  );

  const handleUpdate = useCallback(
    async (input: { name?: string; slug?: string; description?: string }) => {
      if (!editingSet) return;
      await api.updateQuestionSet(editingSet.id, input);
      setEditingSet(null);
      await fetchSets();
    },
    [editingSet, fetchSets],
  );

  const handleArchive = useCallback(async () => {
    if (!archiveTarget) return;
    try {
      await api.archiveQuestionSet(archiveTarget.id);
      setArchiveTarget(null);
      await fetchSets();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Archive failed');
      setArchiveTarget(null);
    }
  }, [archiveTarget, fetchSets]);

  const handleUnarchive = useCallback(
    async (id: string) => {
      try {
        await api.unarchiveQuestionSet(id);
        await fetchSets();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Unarchive failed');
      }
    },
    [fetchSets],
  );

  if (!selectedExamType) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: colors.subtle }}>
        Select an exam type to manage question sets.
      </div>
    );
  }

  const activeSets = sets.filter((s) => !s.archivedAt);
  const archivedSets = sets.filter((s) => !!s.archivedAt);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 28,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: colors.heading,
              margin: 0,
              marginBottom: 6,
            }}
          >
            Question Sets
          </h1>
          <p style={{ color: colors.muted, margin: 0, fontSize: 14 }}>
            Manage question sets for organizing questions. System sets
            (diagnostic, set1) cannot be archived.
          </p>
        </div>

        <button
          onClick={() => {
            setShowForm(true);
            setEditingSet(null);
          }}
          style={{
            padding: '9px 18px',
            background: colors.primary,
            color: '#1A1A2E',
            border: 'none',
            borderRadius: radius.sm,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          + New Set
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: colors.errorMuted,
            border: `1px solid ${colors.error}44`,
            borderRadius: radius.md,
            padding: '12px 16px',
            color: colors.errorText,
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      {/* Create / Edit form */}
      {(showForm || editingSet) && (
        <SetForm
          initial={editingSet}
          onSubmit={editingSet ? handleUpdate : handleCreate}
          onCancel={() => {
            setShowForm(false);
            setEditingSet(null);
          }}
        />
      )}

      {/* Active sets */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: colors.subtle }}>
          Loading...
        </div>
      ) : activeSets.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            color: colors.subtle,
            background: colors.surfaceRaised,
            borderRadius: radius.md,
            border: `1px solid ${colors.borderLight}`,
          }}
        >
          No question sets defined yet. Create one to start grouping questions.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeSets.map((s) => (
            <SetRow
              key={s.id}
              set={s}
              onEdit={() => {
                setEditingSet(s);
                setShowForm(false);
              }}
              onArchive={() => setArchiveTarget(s)}
            />
          ))}
        </div>
      )}

      {/* Archived sets */}
      {archivedSets.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: colors.subtle,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 12,
            }}
          >
            Archived ({archivedSets.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {archivedSets.map((s) => (
              <SetRow
                key={s.id}
                set={s}
                onEdit={() => {
                  setEditingSet(s);
                  setShowForm(false);
                }}
                onUnarchive={() => handleUnarchive(s.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Archive confirmation */}
      {archiveTarget && (
        <ConfirmDialog
          open={!!archiveTarget}
          title="Archive Question Set"
          message={`Archive "${archiveTarget.name}" (${archiveTarget.slug})? Archived sets won't appear in question dropdowns or mobile sync. Questions will keep their set assignment and can be restored later.`}
          confirmLabel="Archive"
          onConfirm={handleArchive}
          onCancel={() => setArchiveTarget(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Set row component
// ---------------------------------------------------------------------------

function SetRow({
  set: s,
  onEdit,
  onArchive,
  onUnarchive,
}: {
  set: QuestionSet;
  onEdit: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
}) {
  const isArchived = !!s.archivedAt;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 18px',
        background: isArchived ? colors.surface : colors.surfaceRaised,
        border: `1px solid ${colors.borderLight}`,
        borderRadius: radius.md,
        opacity: isArchived ? 0.6 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: isArchived ? colors.muted : colors.heading,
            }}
          >
            {s.name}
          </span>
          <code
            style={{
              fontSize: 11,
              color: colors.primaryText,
              background: colors.primaryMuted,
              padding: '1px 6px',
              borderRadius: 4,
              fontFamily: font.mono,
            }}
          >
            {s.slug}
          </code>
          {s.isSystem && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: colors.successText ?? '#10B981',
                background: colors.successMuted ?? 'rgba(16,185,129,0.15)',
                padding: '1px 6px',
                borderRadius: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              System
            </span>
          )}
          {isArchived && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: colors.error,
                background: colors.errorMuted,
                padding: '1px 6px',
                borderRadius: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Archived
            </span>
          )}
        </div>
        {s.description && (
          <div
            style={{
              fontSize: 12,
              color: colors.muted,
              marginBottom: 4,
            }}
          >
            {s.description}
          </div>
        )}
        <div style={{ fontSize: 12, color: colors.subtle }}>
          {s.questionCount} question{s.questionCount !== 1 ? 's' : ''}
        </div>
      </div>

      <button onClick={onEdit} style={actionBtnStyle} title="Edit">
        ✎
      </button>

      {/* Archive/Unarchive — hidden for system sets */}
      {!s.isSystem && !isArchived && onArchive && (
        <button
          onClick={onArchive}
          style={{ ...actionBtnStyle, color: colors.muted }}
          title="Archive"
        >
          ⌓
        </button>
      )}
      {isArchived && onUnarchive && (
        <button
          onClick={onUnarchive}
          style={{ ...actionBtnStyle, color: colors.primaryText }}
          title="Restore"
        >
          ↺
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline form
// ---------------------------------------------------------------------------

function SetForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: QuestionSet | null;
  onSubmit: (input: CreateQuestionSetInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [slug, setSlug] = useState(initial?.slug || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!initial;
  const isSystemSet = initial?.isSystem ?? false;

  // Auto-generate slug from name (skip for system sets)
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSystemSet) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        const payload: { name: string; slug?: string; description?: string } = {
          name,
          description: description || undefined,
        };
        if (!isSystemSet) payload.slug = slug;
        await onSubmit(payload as CreateQuestionSetInput);
      } else {
        await onSubmit({ name, slug, description: description || undefined });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
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
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: 20,
        marginBottom: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: colors.heading }}>
        {isEdit ? 'Edit Set' : 'New Question Set'}
      </div>

      {error && (
        <div
          style={{
            background: colors.errorMuted,
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: radius.sm,
            padding: '8px 12px',
            color: colors.errorText,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label
          style={{
            flex: 1,
            minWidth: 180,
            fontSize: 13,
            fontWeight: 500,
            color: colors.muted,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          Name
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            style={inputStyle}
            placeholder="e.g. Set 1"
            required
          />
        </label>

        <label
          style={{
            flex: 1,
            minWidth: 180,
            fontSize: 13,
            fontWeight: 500,
            color: colors.muted,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          Slug
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            style={inputStyle}
            placeholder="e.g. set1"
            required
            disabled={isSystemSet}
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            title="Lowercase letters, numbers, and hyphens only"
          />
        </label>
      </div>

      <label
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: colors.muted,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        Description (optional)
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={inputStyle}
          placeholder="Brief description of this question set"
        />
      </label>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            border: `1px solid ${colors.border}`,
            color: colors.body,
            borderRadius: radius.sm,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: colors.primary,
            color: '#1A1A2E',
            border: 'none',
            borderRadius: radius.sm,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const actionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: `1px solid ${colors.border}`,
  color: colors.muted,
  borderRadius: radius.sm,
  width: 32,
  height: 32,
  cursor: 'pointer',
  fontSize: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
