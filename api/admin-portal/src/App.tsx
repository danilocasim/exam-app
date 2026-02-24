import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { QuestionListPage } from './pages/QuestionListPage';
import { QuestionDetailPage } from './pages/QuestionDetailPage';
import { ExamTypeListPage } from './pages/ExamTypeListPage';
import { ExamTypeFormPage } from './pages/ExamTypeFormPage';
import { Layout } from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/exam-types" element={<ExamTypeListPage />} />
                  <Route
                    path="/exam-types/new"
                    element={<ExamTypeFormPage />}
                  />
                  <Route
                    path="/exam-types/:id"
                    element={<ExamTypeFormPage />}
                  />
                  <Route path="/questions" element={<QuestionListPage />} />
                  <Route
                    path="/questions/new"
                    element={<QuestionDetailPage />}
                  />
                  <Route
                    path="/questions/:id"
                    element={<QuestionDetailPage />}
                  />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
