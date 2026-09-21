import { AuthProvider } from "./context/AuthProvider";
import { SettingsProvider } from "./context/SettingsProvider";
import { ToastProvider } from "./context/ToastProvider";
import { AppRouter } from "./routes/AppRouter";
import { ToastContainer } from "./components/ui/ToastContainer";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <ErrorBoundary>
            <AppRouter />
          </ErrorBoundary>
        </SettingsProvider>
      </AuthProvider>
      <ToastContainer />
    </ToastProvider>
  );
}
