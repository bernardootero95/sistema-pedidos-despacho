import { useState, useRef, useEffect } from "react";
import { KeyRound } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { ChangePasswordModal } from "../../modules/auth/components/ChangePasswordModal";

/**
 * Dropdown desde el avatar del header. Hoy solo tiene una opción
 * ("Cambiar mi contraseña"); el logout se queda donde ya estaba, en el
 * pie del sidebar, para no mover una acción que el usuario ya conoce.
 */
export const ProfileMenu = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Menú de perfil"
        className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm hover:bg-primary/20 transition-colors"
      >
        {user?.nombre_completo?.charAt(0).toUpperCase() || "U"}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30">
          <div className="px-4 py-2 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900 truncate">
              {user?.nombre_completo}
            </p>
            <p className="text-xs text-slate-500 truncate uppercase">
              {user?.rol}
            </p>
          </div>
          <button
            onClick={() => {
              setIsModalOpen(true);
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <KeyRound className="w-4 h-4 text-slate-400" />
            Cambiar mi contraseña
          </button>
        </div>
      )}

      {isModalOpen && (
        <ChangePasswordModal onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
};
