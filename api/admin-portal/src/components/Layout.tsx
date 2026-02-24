import {
  useState,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ExamTypeSwitcher } from './ExamTypeSwitcher';
import type { ExamType } from '../services/api';
import { api } from '../services/api';
import { colors, radius } from '../theme';

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

export function Layout({ children }: { children: ReactNode }) {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [selectedExamType, setSelectedExamType] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api
      .getExamTypes()
      .then((types) => {
        setExamTypes(types);
        if (types.length > 0 && !selectedExamType)
          setSelectedExamType(types[0].id);
      })
      .catch(() => {});
  }, [selectedExamType]);

  const isActive = (path: string) => {
    const p = location.pathname;
    if (path === '/') return p === '/portal' || p === '/portal/';
    return p.startsWith('/portal' + path);
  };

  return (
    <>
      <InjectCSS />
      <div className="cp-layout">
        <header className="cp-mobile-bar">
          <button
            className="cp-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? '\u2715' : '\u2630'}
          </button>
          <span
            style={{ fontSize: 17, fontWeight: 700, color: colors.heading }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: '#1A1A2E',
                background: colors.primary,
                width: 26,
                height: 26,
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              D
            </span>{' '}
            Dojo Exam
          </span>
          <div style={{ width: 32 }} />
        </header>

        {menuOpen && (
          <div className="cp-overlay" onClick={() => setMenuOpen(false)} />
        )}

        <aside className={'cp-sidebar' + (menuOpen ? ' cp-sidebar-open' : '')}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingBottom: 24,
              borderBottom: `1px solid ${colors.borderLight}`,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: '#1A1A2E',
                background: colors.primary,
                width: 32,
                height: 32,
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              D
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: colors.heading,
                letterSpacing: '-0.5px',
              }}
            >
              Dojo Exam
            </span>
          </div>

          <ExamTypeSwitcher
            examTypes={examTypes}
            selected={selectedExamType}
            onChange={setSelectedExamType}
          />

          <nav
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              flex: 1,
              marginTop: 20,
            }}
          >
            <SideLink
              to="/"
              active={isActive('/')}
              onClick={() => setMenuOpen(false)}
            >
              Dashboard
            </SideLink>
            <SideLink
              to="/exam-types"
              active={isActive('/exam-types')}
              onClick={() => setMenuOpen(false)}
            >
              Exam Types
            </SideLink>
            <SideLink
              to="/questions"
              active={isActive('/questions')}
              onClick={() => setMenuOpen(false)}
            >
              Questions
            </SideLink>
          </nav>

          <div
            style={{
              textAlign: 'center',
              paddingBottom: 12,
              fontSize: 11,
              color: colors.subtle,
              letterSpacing: '0.3px',
            }}
          >
            Powered by{' '}
            <span style={{ color: colors.primary, fontWeight: 600 }}>
              Tutorials Dojo
            </span>
          </div>

          <div
            style={{
              borderTop: `1px solid ${colors.borderLight}`,
              paddingTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: colors.primaryMuted,
                color: colors.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {(admin?.name || admin?.email || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.body,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {admin?.name || 'Admin'}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: colors.subtle,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {admin?.email}
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              style={{
                background: 'none',
                border: `1px solid ${colors.border}`,
                color: colors.muted,
                borderRadius: radius.sm,
                width: 30,
                height: 30,
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {'\u2197'}
            </button>
          </div>
        </aside>

        <main className="cp-main">
          <ExamTypeContext.Provider value={{ selectedExamType, examTypes }}>
            {children}
          </ExamTypeContext.Provider>
        </main>
      </div>
    </>
  );
}

function SideLink({
  to,
  active,
  children,
  onClick,
}: {
  to: string;
  active: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: radius.sm,
        color: active ? colors.primary : colors.muted,
        background: active ? colors.primaryMuted : 'transparent',
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </Link>
  );
}

let _cssInjected = false;
function InjectCSS() {
  if (typeof document !== 'undefined' && !_cssInjected) {
    _cssInjected = true;
    const el = document.createElement('style');
    el.textContent = `
      .cp-layout{display:flex;min-height:100vh}
      .cp-mobile-bar{display:none}
      .cp-overlay{display:none}
      .cp-sidebar{width:260px;background:${colors.surface};border-right:1px solid ${colors.borderLight};display:flex;flex-direction:column;padding:20px;flex-shrink:0;height:100vh;position:sticky;top:0;overflow-y:auto}
      .cp-main{flex:1;padding:32px;overflow:auto;min-width:0}
      .cp-hamburger{background:none;border:none;color:${colors.heading};font-size:22px;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center}
      .cp-mobile-title{font-size:17px;font-weight:700;color:${colors.heading}}
      @media(max-width:768px){
        .cp-mobile-bar{display:flex!important;position:fixed;top:0;left:0;right:0;height:56px;background:${colors.surface};border-bottom:1px solid ${colors.border};align-items:center;justify-content:space-between;padding:0 16px;z-index:100}
        .cp-sidebar{position:fixed;left:-280px;top:0;bottom:0;z-index:200;transition:left .25s ease;width:260px;height:100vh}
        .cp-sidebar-open{left:0!important}
        .cp-overlay{display:block!important;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:199}
        .cp-main{padding:72px 16px 24px}
        .cp-form-row{flex-direction:column!important}
      }
    `;
    document.head.appendChild(el);
  }
  return null;
}
