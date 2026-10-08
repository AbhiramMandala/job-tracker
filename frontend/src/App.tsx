import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { ToastStack, useToasts } from "./components/Toast";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { LoginPage, RegisterPage } from "./pages/Auth";
import { ForgotPasswordPage, ResetPasswordPage } from "./pages/PasswordReset";
import { PublicHomePage } from "./pages/PublicHome";
import { HomePage } from "./pages/Home";
import { ApplicationsPage } from "./pages/Applications";
import { ApplicationDetailPage } from "./pages/ApplicationDetail";
import { ApplicationNewPage } from "./pages/ApplicationNew";
import { InterviewsPage } from "./pages/Interviews";
import { ResumesPage } from "./pages/Resumes";
import { DiscoverPage } from "./pages/Discover";
import { SettingsPage } from "./pages/Settings";
import { ProfilePage } from "./pages/Profile";
import { AdminPage } from "./pages/Admin";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  // Bootstrap failed for a non-auth reason (network/5xx): the session token
  // is kept, so offer a retry instead of bouncing to Sign in.
  if (error && !user) {
    return (
      <div className="mx-auto mt-16 max-w-md px-4 text-center">
        <p className="font-semibold text-slate-800 dark:text-slate-200">We couldn&apos;t restore your session.</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your sign-in may still be valid — check your connection and try again.</p>
        <button
          onClick={() => void refresh()}
          className="mt-4 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Try again
        </button>
      </div>
    );
  }
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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
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
                <Route path="/discover" element={<DiscoverPage notify={notify} />} />
                <Route path="/discover-jobs" element={<Navigate to="/discover" replace />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/admin" element={<AdminPage notify={notify} />} />
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
