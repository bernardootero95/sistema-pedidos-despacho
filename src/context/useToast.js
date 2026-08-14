import { useContext } from "react";
import { ToastContext } from "./ToastContext";

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe ser usado dentro de un ToastProvider");
  }
  return context;
};
