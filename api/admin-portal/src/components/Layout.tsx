import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ExamTypeSwitcher } from './ExamTypeSwitcher';
import type { ExamType } from '../services/api';
import { api } from '../services/api';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Main layout with sidebar navigation and exam type switcher
 */
export function Layout({ children }: LayoutProps) {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [selectedExamType, setSelectedExamType] = useState<string>('');

  useEffect(() => {
    api
      .getExamTypes()
      .then((types) => {
        setExamTypes(types);
        if (types.length > 0 && !selectedExamType) {
          setSelectedExamType(types[0].id);
        }
      })
      .catch(() => {});
  }, [selectedExamType]);

  return (
    <div style={styles.wrapper}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <span style={styles.brandIcon}>☁</span>
          <span style={styles.brandText}>CloudPrep</span>
        </div>

        <ExamTypeSwitcher
          examTypes={examTypes}
          selected={selectedExamType}
          onChange={setSelectedExamType}
        />

        <nav style={styles.nav}>
          <NavLink
            to="/"
            active={
              location.pathname === '/portal' ||
              location.pathname === '/portal/'
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/questions"
            active={location.pathname.startsWith('/portal/questions')}
          >
            Questions
          </NavLink>
        </nav>

        <div style={styles.userSection}>
          <div style={styles.userName}>{admin?.name || admin?.email}</div>
          <button onClick={logout} style={styles.logoutBtn}>
            Sign Out
          </button>
        </div>
      </aside>

      <main style={styles.content}>
        {/* Pass selectedExamType via context-like prop drilling through children clone */}
        {typeof children === 'object' && children !== null
          ? cloneWithExamType(children, selectedExamType, examTypes)
          : children}
      </main>
    </div>
  );
}

function cloneWithExamType(
  children: ReactNode,
  selectedExamType: string,
  examTypes: ExamType[],
): ReactNode {
  // We use a simple approach: wrap in a div with data attributes
  // The actual pages will use a hook to get the exam type
  return (
    <ExamTypeContext.Provider value={{ selectedExamType, examTypes }}>
      {children}
    </ExamTypeContext.Provider>
  );
}

// Simple context for selected exam type
import { createContext, useContext } from 'react';

interface ExamTypeContextType {
  selectedExamType: string;
  examTypes: ExamType[];
}

const ExamTypeContext = createContext<ExamTypeContextType>({
  selectedExamType: '',
  examTypes: [],
});

export function useSelectedExamType() {
  return useContext(ExamTypeContext);
}

function NavLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      style={{
        ...styles.navLink,
        ...(active ? styles.navLinkActive : {}),
      }}
    >
      {children}
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    width: 240,
    background: '#1a1a2e',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    padding: 16,
    flexShrink: 0,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 0 20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  brandIcon: { fontSize: 20 },
  brandText: { fontSize: 18, fontWeight: 700 },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    marginTop: 16,
  },
  navLink: {
    display: 'block',
    padding: '8px 12px',
    borderRadius: 4,
    color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    fontSize: 14,
  },
  navLinkActive: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
  },
  userSection: {
    borderTop: '1px solid rgba(255,255,255,0.1)',
    paddingTop: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  userName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.7)',
    borderRadius: 4,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 24,
    overflow: 'auto',
    background: '#f5f5f5',
  },
};
