import { colors, radius, shadow } from '../theme';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantColors = {
  danger: { bg: colors.error, text: '#fff' },
  warning: { bg: colors.warning, text: '#1A1A2E' },
  info: { bg: colors.primary, text: '#1A1A2E' },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  const vc = variantColors[variant];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        style={{
          background: colors.surfaceRaised,
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          boxShadow: shadow.lg,
          padding: 24,
          maxWidth: 440,
          width: '90%',
          animation: 'fadeIn 0.15s ease',
        }}
      >
        <h3
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: colors.heading,
            margin: '0 0 12px 0',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: colors.body,
            margin: '0 0 24px 0',
          }}
        >
          {message}
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '8px 20px',
              background: 'transparent',
              border: `1px solid ${colors.border}`,
              color: colors.body,
              borderRadius: radius.sm,
              cursor: loading ? 'default' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
              opacity: loading ? 0.5 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '8px 20px',
              background: vc.bg,
              color: vc.text,
              border: 'none',
              borderRadius: radius.sm,
              cursor: loading ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 700,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
