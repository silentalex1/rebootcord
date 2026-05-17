import { useState } from "react";
import { ThemeProvider } from "next-themes";
import Landing from "./components/Landing";
import Dashboard from "./components/Dashboard";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  const [config, setConfig] = useState(null);

  function handleLogin(cfg) {
    setConfig(cfg);
  }

  function handleBack() {
    setConfig(null);
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <div className="min-h-screen bg-background text-foreground font-sans antialiased">
        {!config ? (
          <Landing onLogin={handleLogin} />
        ) : (
          <Dashboard config={config} onBack={handleBack} />
        )}
        <Toaster position="bottom-right" />
      </div>
    </ThemeProvider>
  );
}
