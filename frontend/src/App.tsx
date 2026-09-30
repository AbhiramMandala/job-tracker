import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { LoginPage, RegisterPage } from "./pages/Auth";
import { DashboardPage } from "./pages/Dashboard";
import { ApplicationsPage } from "./pages/Applications";
import { ApplicationDetailPage } from "./pages/ApplicationDetail";
import { ApplicationNewPage } from "./pages/ApplicationNew";
import { InterviewsPage } from "./pages/Interviews";
import { ResumesPage } from "./pages/Resumes";
import { SettingsPage } from "./pages/Settings";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

function Shell() {
  const [toast, setToast] = useState<string | null>(null);
  const notify = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 3000);
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Layout toast={toast}>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/applications" element={<ApplicationsPage notify={notify} />} />
                <Route path="/applications/new" element={<ApplicationNewPage notify={notify} />} />
                <Route path="/applications/:id" element={<ApplicationDetailPage notify={notify} />} />
                <Route path="/interviews" element={<InterviewsPage notify={notify} />} />
                <Route path="/resumes" element={<ResumesPage notify={notify} />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export function App() {
  useEffect(() => {
    document.title = "Student Job Tracker";
  }, []);
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}
