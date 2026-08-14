import { useCallback, useRef, useState } from "react";
import { ToastContext } from "./ToastContext";

const DEFAULT_DURATION = 5000;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const nextIdRef = useRef(1);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "info", duration = DEFAULT_DURATION) => {
      const id = nextIdRef.current++;
      setToasts((prev) => [...prev, { id, message, type }]);

      if (duration > 0) {
        setTimeout(() => dismissToast(id), duration);
      }

      return id;
    },
    [dismissToast],
  );

  const value = {
    toasts,
    dismissToast,
    showToast,
    showSuccess: (message, duration) =>
      showToast(message, "success", duration),
    showError: (message, duration) => showToast(message, "error", duration),
    showWarning: (message, duration) =>
      showToast(message, "warning", duration),
    showInfo: (message, duration) => showToast(message, "info", duration),
  };

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
};
