import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadow } from '../theme';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.logoRow}>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#1A1A2E', background: colors.primary, width: 44, height: 44, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            D
          </span>
          <span style={styles.logoText}>Dojo Exam</span>
        </div>
        <p style={styles.subtitle}>Admin Portal</p>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>
          <span style={styles.labelText}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
            placeholder="admin@tutorialsdojo.com"
          />
        </label>

        <label style={styles.label}>
          <span style={styles.labelText}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
            placeholder={'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
          />
        </label>

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <div style={styles.poweredBy}>
          Powered by{' '}
          <span style={{ color: colors.primary, fontWeight: 600 }}>
            Tutorials Dojo
          </span>
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: `linear-gradient(135deg, ${colors.background} 0%, #1A2332 100%)`,
    padding: 20,
  },
  form: {
    background: colors.surfaceRaised,
    padding: '40px 36px',
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    boxShadow: shadow.lg,
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoText: {
    fontSize: 26,
    fontWeight: 700,
    color: colors.heading,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: -8,
  },
  error: {
    background: colors.errorMuted,
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: radius.sm,
    padding: '10px 14px',
    color: colors.errorText,
    fontSize: 13,
  },
  label: { display: 'flex', flexDirection: 'column', gap: 6 },
  labelText: { fontSize: 13, fontWeight: 500, color: colors.muted },
  input: {
    padding: '10px 14px',
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    fontSize: 14,
    color: colors.heading,
    outline: 'none',
  },
  button: {
    padding: '12px 20px',
    background: colors.primary,
    color: '#1A1A2E',
    border: 'none',
    borderRadius: radius.sm,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
    letterSpacing: '0.3px',
  },
  poweredBy: {
    marginTop: 24,
    fontSize: 12,
    color: colors.subtle,
    textAlign: 'center',
    letterSpacing: '0.3px',
  },
};
