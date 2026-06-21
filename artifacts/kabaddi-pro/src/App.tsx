import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient();

const KabaddiApp = lazy(() => import("@/app/page"));

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <Suspense fallback={
          <div className="min-h-screen bg-gradient-to-br from-red-700 via-red-800 to-red-950 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center">
                <img src="/app-icon.png" alt="Kabaddi Pro" className="w-12 h-12 rounded-xl" />
              </div>
              <p className="text-white/70 text-sm">Loading...</p>
            </div>
          </div>
        }>
          <KabaddiApp />
        </Suspense>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
