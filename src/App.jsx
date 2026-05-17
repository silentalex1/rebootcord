import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Landing from "./components/Landing";
import AuthAccount from "./components/AuthAccount";
import ProjectsDashboard from "./components/ProjectsDashboard";
import ProjectPage from "./components/ProjectPage";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground font-sans antialiased">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/authaccount" element={<AuthAccount />} />
            <Route path="/dashboard" element={<ProjectsDashboard />} />
            <Route path="/project/:projectId" element={<ProjectPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="bottom-right" />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
