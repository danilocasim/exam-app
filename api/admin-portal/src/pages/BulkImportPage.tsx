import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api,
  type BulkImportPayload,
  type BulkImportValidationResult,
  type BulkImportResult,
  type ImportValidationError,
  type ImportDuplicateInfo,
} from '../services/api';
import { useSelectedExamType } from '../components/Layout';
import { colors, radius, shadow, font } from '../theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageState = 'idle' | 'validating' | 'validated' | 'importing' | 'success' | 'error';

interface ParsedFile {
  name: string;
  sizeKb: number;
  payload: BulkImportPayload;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeText(t: string) {
  return t.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Client-side pre-validation — catches structural issues before hitting the server.
 * Returns an array of human-readable error strings (empty = structurally OK).
 */
function clientPreValidate(payload: BulkImportPayload): string[] {
  const errs: string[] = [];

  if (!payload.examTypeId || typeof payload.examTypeId !== 'string') {
    errs.push('Missing or invalid "examTypeId" field at the top level.');
  }
  if (!Array.isArray(payload.questions)) {
    errs.push('"questions" must be an array.');
    return errs;
  }
  if (payload.questions.length === 0) {
    errs.push('"questions" array is empty — nothing to import.');
  }
  if (payload.questions.length > 500) {
    errs.push(`Too many questions: ${payload.questions.length}. Maximum is 500 per upload.`);
  }

  const VALID_TYPES = new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE']);
  const VALID_DIFF = new Set(['EASY', 'MEDIUM', 'HARD']);
  const REQUIRED = ['text', 'type', 'domain', 'difficulty', 'options', 'correctAnswers', 'explanation'];

  for (let i = 0; i < Math.min(payload.questions.length, 500); i++) {
    const q = payload.questions[i] as Record<string, unknown>;
    const prefix = `Question [${i}]`;

    for (const field of REQUIRED) {
      if (q[field] === undefined || q[field] === null) {
        errs.push(`${prefix}: missing required field "${field}".`);
      }
    }

    if (typeof q.type === 'string' && !VALID_TYPES.has(q.type)) {
      errs.push(`${prefix}: invalid type "${q.type}". Must be SINGLE_CHOICE, MULTIPLE_CHOICE, or TRUE_FALSE.`);
    }
    if (typeof q.difficulty === 'string' && !VALID_DIFF.has(q.difficulty)) {
      errs.push(`${prefix}: invalid difficulty "${q.difficulty}". Must be EASY, MEDIUM, or HARD.`);
    }
    if (!Array.isArray(q.options) || (q.options as unknown[]).length < 2) {
      errs.push(`${prefix}: "options" must be an array with at least 2 items.`);
    }
    if (!Array.isArray(q.correctAnswers) || (q.correctAnswers as unknown[]).length < 1) {
      errs.push(`${prefix}: "correctAnswers" must be an array with at least 1 item.`);
    }

    // Bail out after 20 structural errors to keep the list readable
    if (errs.length >= 20) {
      errs.push(`…and more. Fix the above issues and re-upload.`);
      break;
    }
  }

  return errs;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: colors.surfaceRaised,
        border: `1px solid ${colors.borderLight}`,
        borderRadius: radius.md,
        padding: '16px 20px',
        flex: '1 1 120px',
        minWidth: 100,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: accent ?? colors.heading,
          lineHeight: 1.1,
          fontFamily: font.mono,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: colors.subtle, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: `${color}22`,
        color,
        fontFamily: font.mono,
      }}
    >
      {label}
    </span>
  );
}

function CollapsibleSection({
  title,
  count,
  accentColor,
  children,
  defaultOpen,
}: {
  title: string;
  count: number;
  accentColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  if (count === 0) return null;
  return (
    <div
      style={{
        border: `1px solid ${accentColor}44`,
        borderRadius: radius.md,
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: `${accentColor}11`,
          border: 'none',
          cursor: 'pointer',
          color: accentColor,
          fontWeight: 600,
          fontSize: 13,
          textAlign: 'left',
        }}
      >
        <span>
          {title}{' '}
          <span
            style={{
              background: accentColor,
              color: '#000',
              borderRadius: 10,
              padding: '1px 7px',
              fontSize: 11,
              fontWeight: 700,
              marginLeft: 6,
            }}
          >
            {count}
          </span>
        </span>
        <span style={{ fontSize: 16 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ErrorRow({ err }: { err: ImportValidationError }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '8px 10px',
        background: colors.surfaceRaised,
        borderRadius: radius.sm,
        fontSize: 13,
      }}
    >
      <Badge label={`Q${err.questionIndex}`} color={colors.error} />
      <span style={{ color: colors.errorText, fontFamily: font.mono, fontSize: 12 }}>
        {err.field}
      </span>
      <span style={{ color: colors.body, flex: 1 }}>{err.message}</span>
    </div>
  );
}

function DuplicateRow({ dup }: { dup: ImportDuplicateInfo }) {
  const isFile = dup.reason === 'DUPLICATE_IN_FILE';
  const accentColor = isFile ? colors.warning : colors.info;
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '8px 10px',
        background: colors.surfaceRaised,
        borderRadius: radius.sm,
        fontSize: 13,
      }}
    >
      <Badge label={`Q${dup.questionIndex}`} color={accentColor} />
      <Badge
        label={isFile ? 'In-file dup' : 'Already in DB'}
        color={accentColor}
      />
      {dup.conflictsWithIndex !== undefined && (
        <span style={{ color: colors.subtle, fontSize: 12 }}>
          (same as Q{dup.conflictsWithIndex})
        </span>
      )}
      <span
        style={{
          color: colors.muted,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontStyle: 'italic',
          fontSize: 12,
        }}
        title={dup.text}
      >
        "{dup.text.length > 80 ? dup.text.slice(0, 80) + '…' : dup.text}"
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function BulkImportPage() {
  const navigate = useNavigate();
  const { selectedExamType } = useSelectedExamType();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [pageState, setPageState] = useState<PageState>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [validation, setValidation] = useState<BulkImportValidationResult | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Auto-fill examTypeId from context when the file hasn't been loaded yet
  const effectiveExamTypeId = parsedFile?.payload.examTypeId ?? selectedExamType;

  // ---- File processing ----

  const processFile = useCallback(
    async (file: File) => {
      setParseErrors([]);
      setValidation(null);
      setGlobalError(null);
      setImportResult(null);
      setPageState('idle');

      if (!file.name.endsWith('.json')) {
        setParseErrors(['Only .json files are accepted.']);
        setParsedFile(null);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setParseErrors(['File exceeds the 5 MB limit.']);
        setParsedFile(null);
        return;
      }

      let raw: string;
      try {
        raw = await file.text();
      } catch {
        setParseErrors(['Could not read the file.']);
        setParsedFile(null);
        return;
      }

      // Strip JS-style single-line comments (// ...) — often present in templates
      const stripped = raw.replace(/^\s*\/\/.*$/gm, '');

      let payload: BulkImportPayload;
      try {
        payload = JSON.parse(stripped);
      } catch (e: unknown) {
        const msg = e instanceof SyntaxError ? e.message : String(e);
        setParseErrors([`Invalid JSON: ${msg}`]);
        setParsedFile(null);
        return;
      }

      // Remove _-prefixed documentation keys added by the template
      payload = stripDocKeys(payload);

      // Overwrite examTypeId from context if file doesn't have one set
      if (!payload.examTypeId && selectedExamType) {
        payload.examTypeId = selectedExamType;
      }

      const clientErrs = clientPreValidate(payload);
      if (clientErrs.length > 0) {
        setParseErrors(clientErrs);
        setParsedFile(null);
        return;
      }

      setParsedFile({
        name: file.name,
        sizeKb: Math.ceil(file.size / 1024),
        payload,
      });

      // Immediately kick off server-side validation
      await runServerValidation(payload);
    },
    [selectedExamType], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function stripDocKeys(payload: unknown): BulkImportPayload {
    if (typeof payload !== 'object' || payload === null) return payload as BulkImportPayload;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if (k.startsWith('_')) continue;
      if (Array.isArray(v)) {
        result[k] = v.map((item) =>
          typeof item === 'object' && item !== null ? stripDocKeys(item) : item,
        );
      } else if (typeof v === 'object' && v !== null) {
        result[k] = stripDocKeys(v);
      } else {
        result[k] = v;
      }
    }
    return result as BulkImportPayload;
  }

  async function runServerValidation(payload: BulkImportPayload) {
    setPageState('validating');
    setGlobalError(null);
    try {
      const result = await api.validateBulkImport(payload);
      setValidation(result);
      setPageState('validated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setGlobalError(`Validation failed: ${msg}`);
      setPageState('error');
    }
  }

  // ---- Drag-and-drop handlers ----

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset so the same file can be re-selected after clearing
      e.target.value = '';
    },
    [processFile],
  );

  // ---- Import ----

  async function handleImport() {
    if (!parsedFile || !validation?.valid) return;
    setPageState('importing');
    setGlobalError(null);
    try {
      const result = await api.bulkImport(parsedFile.payload);
      setImportResult(result);
      setPageState('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setGlobalError(`Import failed: ${msg}`);
      setPageState('error');
    }
  }

  function handleClear() {
    setParsedFile(null);
    setValidation(null);
    setParseErrors([]);
    setGlobalError(null);
    setImportResult(null);
    setPageState('idle');
  }

  // ---- Template download ----

  function downloadTemplate() {
    const url = api.getBulkImportTemplateUrl(effectiveExamTypeId || undefined);
    const a = document.createElement('a');
    a.href = url;
    // Include auth header via a fetch+blob fallback (template endpoint is protected)
    const token = localStorage.getItem('admin_token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        a.href = objUrl;
        a.download = effectiveExamTypeId
          ? `questions-template-${effectiveExamTypeId}.json`
          : 'questions-template.json';
        a.click();
        URL.revokeObjectURL(objUrl);
      })
      .catch(() => {
        // Fallback: navigate directly (will prompt download if server sets headers)
        window.open(url, '_blank');
      });
  }

  // ---- Derived state ----

  const canImport =
    pageState === 'validated' &&
    validation?.valid === true &&
    parsedFile !== null;

  const isWorking = pageState === 'validating' || pageState === 'importing';

  // ---- Render ----

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
            Bulk Import Questions
          </h1>
          <p style={{ color: colors.muted, margin: 0, fontSize: 14 }}>
            Upload a JSON file to add multiple questions at once. All questions
            are imported as <Badge label="DRAFT" color={colors.muted} />.
          </p>
        </div>

        <button
          onClick={downloadTemplate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 16px',
            background: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.sm,
            color: colors.body,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          ↓ Download Template
        </button>
      </div>

      {/* Success state */}
      {pageState === 'success' && importResult && (
        <div
          style={{
            background: colors.successMuted,
            border: `1px solid ${colors.success}44`,
            borderRadius: radius.md,
            padding: 24,
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
          <div
            style={{ fontSize: 20, fontWeight: 700, color: colors.successText, marginBottom: 8 }}
          >
            {importResult.imported} question{importResult.imported !== 1 ? 's' : ''} imported
            successfully
          </div>
          <p style={{ color: colors.muted, margin: '0 0 16px' }}>
            Exam type: <strong style={{ color: colors.body }}>{importResult.examTypeId}</strong>.
            All questions are saved as DRAFT — review and approve them individually.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/questions')}
              style={btnStyle(colors.primary, '#000')}
            >
              View Questions
            </button>
            <button onClick={handleClear} style={btnStyle(colors.surfaceHover, colors.body)}>
              Import Another File
            </button>
          </div>
        </div>
      )}

      {pageState !== 'success' && (
        <>
          {/* Drop zone */}
          <div
            ref={dropZoneRef}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !isWorking && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${
                isDragging
                  ? colors.primary
                  : parsedFile
                    ? colors.success
                    : colors.border
              }`,
              borderRadius: radius.lg,
              padding: '40px 24px',
              textAlign: 'center',
              cursor: isWorking ? 'default' : 'pointer',
              background: isDragging
                ? colors.primaryMuted
                : parsedFile
                  ? colors.successMuted
                  : colors.surfaceRaised,
              transition: 'all 0.15s ease',
              marginBottom: 24,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />

            {isWorking ? (
              <div style={{ color: colors.muted }}>
                <Spinner />
                <div style={{ marginTop: 10, fontSize: 14 }}>
                  {pageState === 'validating' ? 'Validating…' : 'Importing…'}
                </div>
              </div>
            ) : parsedFile ? (
              <div>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                <div style={{ fontWeight: 600, color: colors.heading, fontSize: 15 }}>
                  {parsedFile.name}
                </div>
                <div style={{ color: colors.subtle, fontSize: 12, marginTop: 2 }}>
                  {parsedFile.sizeKb} KB · {parsedFile.payload.questions.length} question
                  {parsedFile.payload.questions.length !== 1 ? 's' : ''} detected ·{' '}
                  {parsedFile.payload.examTypeId}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  style={{
                    marginTop: 10,
                    background: 'none',
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.sm,
                    color: colors.muted,
                    cursor: 'pointer',
                    padding: '4px 12px',
                    fontSize: 12,
                  }}
                >
                  Clear
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.5 }}>📂</div>
                <div style={{ fontWeight: 600, color: colors.body, fontSize: 15 }}>
                  Drag & drop your JSON file here
                </div>
                <div style={{ color: colors.subtle, fontSize: 13, marginTop: 4 }}>
                  or click to browse — .json only, max 5 MB, max 500 questions
                </div>
              </div>
            )}
          </div>

          {/* Client parse errors */}
          {parseErrors.length > 0 && (
            <div
              style={{
                background: colors.errorMuted,
                border: `1px solid ${colors.error}44`,
                borderRadius: radius.md,
                padding: 16,
                marginBottom: 24,
              }}
            >
              <div
                style={{ fontWeight: 600, color: colors.errorText, marginBottom: 8, fontSize: 13 }}
              >
                File cannot be parsed:
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 18px', color: colors.errorText, fontSize: 13 }}>
                {parseErrors.map((e, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Global / server error */}
          {globalError && (
            <div
              style={{
                background: colors.errorMuted,
                border: `1px solid ${colors.error}44`,
                borderRadius: radius.md,
                padding: 16,
                marginBottom: 24,
                color: colors.errorText,
                fontSize: 13,
              }}
            >
              {globalError}
            </div>
          )}

          {/* Validation preview */}
          {validation && pageState === 'validated' && (
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 16,
                }}
              >
                <SummaryCard
                  label="Total questions"
                  value={validation.summary.total}
                  accent={colors.info}
                />
                <SummaryCard
                  label="Errors"
                  value={validation.summary.errors}
                  accent={
                    validation.summary.errors > 0 ? colors.error : colors.success
                  }
                />
                <SummaryCard
                  label="Duplicates in file"
                  value={validation.summary.duplicatesInFile}
                  accent={
                    validation.summary.duplicatesInFile > 0
                      ? colors.warning
                      : colors.success
                  }
                />
                <SummaryCard
                  label="Already in DB"
                  value={validation.summary.duplicatesInDb}
                  accent={
                    validation.summary.duplicatesInDb > 0
                      ? colors.warning
                      : colors.success
                  }
                />
              </div>

              {validation.valid ? (
                <div
                  style={{
                    background: colors.successMuted,
                    border: `1px solid ${colors.success}44`,
                    borderRadius: radius.md,
                    padding: '12px 16px',
                    color: colors.successText,
                    fontWeight: 600,
                    fontSize: 14,
                    marginBottom: 16,
                  }}
                >
                  ✓ All questions passed validation — ready to import.
                </div>
              ) : (
                <div
                  style={{
                    background: colors.errorMuted,
                    border: `1px solid ${colors.error}44`,
                    borderRadius: radius.md,
                    padding: '12px 16px',
                    color: colors.errorText,
                    fontWeight: 600,
                    fontSize: 14,
                    marginBottom: 16,
                  }}
                >
                  ✗ Fix all errors and duplicates before importing.
                </div>
              )}

              <CollapsibleSection
                title="Validation Errors"
                count={validation.errors.length}
                accentColor={colors.error}
                defaultOpen={validation.errors.length <= 10}
              >
                {validation.errors.map((err, i) => (
                  <ErrorRow key={i} err={err} />
                ))}
              </CollapsibleSection>

              <CollapsibleSection
                title="Duplicates"
                count={validation.duplicates.length}
                accentColor={colors.warning}
                defaultOpen={validation.duplicates.length <= 10}
              >
                {validation.duplicates.map((dup, i) => (
                  <DuplicateRow key={i} dup={dup} />
                ))}
              </CollapsibleSection>
            </div>
          )}

          {/* Action buttons */}
          {parsedFile && !isWorking && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                disabled={!canImport}
                onClick={handleImport}
                style={btnStyle(
                  canImport ? colors.primary : colors.surfaceHover,
                  canImport ? '#000' : colors.subtle,
                  !canImport,
                )}
              >
                {canImport
                  ? `Import ${parsedFile.payload.questions.length} Question${parsedFile.payload.questions.length !== 1 ? 's' : ''}`
                  : 'Fix Errors to Enable Import'}
              </button>

              <button
                onClick={() => parsedFile && runServerValidation(parsedFile.payload)}
                style={btnStyle(colors.surfaceHover, colors.body)}
              >
                Re-validate
              </button>

              <button onClick={handleClear} style={btnStyle(colors.surfaceHover, colors.muted)}>
                Clear
              </button>
            </div>
          )}

          {/* Schema documentation */}
          <SchemaDoc />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schema documentation panel
// ---------------------------------------------------------------------------

function SchemaDoc() {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        marginTop: 40,
        border: `1px solid ${colors.borderLight}`,
        borderRadius: radius.md,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: colors.surfaceRaised,
          border: 'none',
          cursor: 'pointer',
          color: colors.muted,
          fontWeight: 600,
          fontSize: 13,
          textAlign: 'left',
        }}
      >
        <span>JSON Format Reference</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: 20, background: colors.surface, fontSize: 13 }}>
          <p style={{ color: colors.body, marginTop: 0 }}>
            The uploaded file must be a JSON object with exactly this structure:
          </p>

          <FieldTable
            rows={[
              ['examTypeId', 'string', 'Required', 'Must match an existing exam type ID (e.g. "CLF-C02").'],
              ['questions', 'array', 'Required', 'Array of question objects — min 1, max 500.'],
            ]}
          />

          <p style={{ color: colors.body, margin: '16px 0 6px', fontWeight: 600 }}>
            Each question object:
          </p>

          <FieldTable
            rows={[
              ['text', 'string', 'min 20 chars', 'The full question stem.'],
              ['type', 'enum', 'Required', 'SINGLE_CHOICE | MULTIPLE_CHOICE | TRUE_FALSE'],
              ['domain', 'string', 'Required', 'Must match a domain id defined on the exam type.'],
              ['difficulty', 'enum', 'Required', 'EASY | MEDIUM | HARD'],
              ['options', 'array', 'min 2 items', 'Array of { id: string, text: string }. IDs must be unique.'],
              ['correctAnswers', 'string[]', 'min 1', 'Option IDs. SINGLE_CHOICE allows exactly 1. TRUE_FALSE allows exactly 1.'],
              ['explanation', 'string', 'min 50 chars', 'Full explanation shown after the student answers.'],
              ['explanationBlocks', 'array?', 'Optional', 'Structured rich-text blocks (same as single-question editor).'],
            ]}
          />

          <p style={{ color: colors.body, margin: '16px 0 6px', fontWeight: 600 }}>
            Common mistakes:
          </p>
          <ul style={{ color: colors.muted, margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              <code style={{ color: colors.primaryText }}>correctAnswers</code> values must exactly
              match <code style={{ color: colors.primaryText }}>options[].id</code> (case-sensitive).
            </li>
            <li>TRUE_FALSE questions require exactly 2 options.</li>
            <li>SINGLE_CHOICE questions must have exactly 1 correct answer.</li>
            <li>
              Duplicate question text (even with different casing or whitespace) is rejected.
            </li>
            <li>
              Questions already existing in the database for this exam type are rejected as
              duplicates.
            </li>
            <li>If any question fails validation, the entire file is rejected (no partial inserts).</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function FieldTable({ rows }: { rows: [string, string, string, string][] }) {
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
        fontFamily: font.sans,
      }}
    >
      <thead>
        <tr style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
          {['Field', 'Type', 'Constraint', 'Description'].map((h) => (
            <th
              key={h}
              style={{
                padding: '6px 10px',
                textAlign: 'left',
                color: colors.subtle,
                fontWeight: 600,
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([field, type, constraint, desc]) => (
          <tr
            key={field}
            style={{ borderBottom: `1px solid ${colors.borderLight}` }}
          >
            <td
              style={{
                padding: '7px 10px',
                color: colors.primaryText,
                fontFamily: font.mono,
                whiteSpace: 'nowrap',
              }}
            >
              {field}
            </td>
            <td
              style={{
                padding: '7px 10px',
                color: colors.infoText,
                fontFamily: font.mono,
                whiteSpace: 'nowrap',
              }}
            >
              {type}
            </td>
            <td
              style={{
                padding: '7px 10px',
                color: colors.warningText,
                whiteSpace: 'nowrap',
              }}
            >
              {constraint}
            </td>
            <td style={{ padding: '7px 10px', color: colors.body }}>{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

function btnStyle(bg: string, color: string, disabled = false): React.CSSProperties {
  return {
    padding: '10px 20px',
    background: bg,
    color,
    border: 'none',
    borderRadius: radius.sm,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
    fontSize: 14,
    opacity: disabled ? 0.6 : 1,
    transition: 'opacity 0.15s',
  };
}

function Spinner() {
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'bulk-spinner';
    if (!document.getElementById('bulk-spinner')) {
      el.textContent = `@keyframes bulk-spin{to{transform:rotate(360deg)}}`;
      document.head.appendChild(el);
    }
  }, []);

  return (
    <div
      style={{
        display: 'inline-block',
        width: 28,
        height: 28,
        border: `3px solid ${colors.borderLight}`,
        borderTopColor: colors.primary,
        borderRadius: '50%',
        animation: 'bulk-spin 0.7s linear infinite',
      }}
    />
  );
}
