import { useState } from "react";
import { ThemeProvider } from "next-themes";
import Landing from "./components/Landing";
import Dashboard from "./components/Dashboard";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  const [view, setView] = useState("landing");

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <div className="min-h-screen bg-background text-foreground font-sans antialiased">
        {view === "landing" ? (
          <Landing onStart={() => setView("dashboard")} />
        ) : (
          <Dashboard onBack={() => setView("landing")} />
        )}
        <Toaster position="bottom-right" />
      </div>
    </ThemeProvider>
  );
}
