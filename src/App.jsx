import { AuthProvider } from "./context/AuthProvider";
import { ToastProvider } from "./context/ToastProvider";
import { AppRouter } from "./routes/AppRouter";
import { ToastContainer } from "./components/ui/ToastContainer";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ErrorBoundary>
          <AppRouter />
        </ErrorBoundary>
      </AuthProvider>
      <ToastContainer />
    </ToastProvider>
  );
}
