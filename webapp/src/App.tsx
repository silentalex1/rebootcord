import { BrowserRouter, Route, Routes } from "react-router-dom";
import { SessionProvider } from "./lib/session";
import { ToastProvider } from "./lib/toast";
import { RequireAuth } from "./components/RequireAuth";
import { HomePage } from "./pages/HomePage";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProjectPage } from "./pages/ProjectPage";
import { InboxPage } from "./pages/InboxPage";
import { ChangelogsPage } from "./pages/ChangelogsPage";
import { ApiPage } from "./pages/ApiPage";

export default function App() {
  return (
    <SessionProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/account-setup" element={<AuthPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard/project/:id"
              element={
                <RequireAuth>
                  <ProjectPage />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard/inbox"
              element={
                <RequireAuth>
                  <InboxPage />
                </RequireAuth>
              }
            />
            <Route
              path="/inbox"
              element={
                <RequireAuth>
                  <InboxPage />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard/changelogs"
              element={
                <RequireAuth>
                  <ChangelogsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/changelogs"
              element={
                <RequireAuth>
                  <ChangelogsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/changelog"
              element={
                <RequireAuth>
                  <ChangelogsPage />
                </RequireAuth>
              }
            />
            <Route path="/our-api" element={<ApiPage />} />
            <Route
              path="*"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </SessionProvider>
  );
}
