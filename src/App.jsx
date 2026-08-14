import { AuthProvider } from "./context/AuthProvider";
import { ToastProvider } from "./context/ToastProvider";
import { AppRouter } from "./routes/AppRouter";
import { ToastContainer } from "./components/ui/ToastContainer";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
      <ToastContainer />
    </ToastProvider>
  );
}
