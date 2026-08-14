import { useToast } from "../../context/useToast";
import { Toast } from "./Toast";

export const ToastContainer = () => {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => dismissToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};
