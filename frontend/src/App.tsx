import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { ToastStack, useToasts } from "./components/Toast";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { LoginPage, RegisterPage } from "./pages/Auth";
import { PublicHomePage } from "./pages/PublicHome";
import { HomePage } from "./pages/Home";
import { ApplicationsPage } from "./pages/Applications";
import { ApplicationDetailPage } from "./pages/ApplicationDetail";
import { ApplicationNewPage } from "./pages/ApplicationNew";
import { InterviewsPage } from "./pages/Interviews";
import { ResumesPage } from "./pages/Resumes";
import { DiscoverPage } from "./pages/Discover";
import { SettingsPage } from "./pages/Settings";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/sign-in" state={{ from: location.pathname }} replace />;
  return children;
}

export { RequireAuth };

function Shell() {
  const { toasts, notify, dismiss } = useToasts();

  return (
    <>
      <ToastStack items={toasts} onDone={dismiss} />
      <Routes>
      <Route path="/" element={<PublicHomePage />} />
      <Route path="/sign-in" element={<LoginPage />} />
      <Route path="/sign-up" element={<RegisterPage />} />
      <Route path="/login" element={<Navigate to="/sign-in" replace />} />
      <Route path="/register" element={<Navigate to="/sign-up" replace />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Layout>
              <Routes>
                <Route path="/home" element={<HomePage />} />
                <Route path="/dashboard" element={<Navigate to="/home" replace />} />
                <Route path="/applications" element={<ApplicationsPage notify={notify} />} />
                <Route path="/applications/new" element={<ApplicationNewPage notify={notify} />} />
                <Route path="/applications/:id" element={<ApplicationDetailPage notify={notify} />} />
                <Route path="/interviews" element={<InterviewsPage notify={notify} />} />
                <Route path="/resumes" element={<ResumesPage notify={notify} />} />
                <Route path="/discover-jobs" element={<DiscoverPage notify={notify} />} />
                <Route path="/discover" element={<Navigate to="/discover-jobs" replace />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </Layout>
          </RequireAuth>
        }
      />
      </Routes>
    </>
  );
}

export function App() {
  useEffect(() => {
    document.title = "Student Job Tracker";
  }, []);
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
