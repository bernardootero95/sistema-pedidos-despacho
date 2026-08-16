import { Component } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";

/**
 * Red de seguridad para toda la app: React solo expone la captura de
 * errores de render vía componentDidCatch/getDerivedStateFromError en
 * componentes de clase, no hay equivalente con hooks todavía. Sin esto,
 * cualquier error de render en cualquier página deja al usuario en
 * pantalla blanca sin ninguna salida.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      "[ErrorBoundary] Error de render capturado:",
      error,
      errorInfo?.componentStack,
    );
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full flex flex-col items-center text-center gap-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-full">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            Ocurrió un error inesperado
          </h1>
          <p className="text-sm text-slate-500">
            Algo falló al mostrar esta pantalla. Intenta recargar; si el
            problema persiste, contacta a soporte.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
            <button
              onClick={this.handleReload}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-hover transition-colors"
            >
              <RotateCw className="w-4 h-4" />
              Recargar
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <Home className="w-4 h-4" />
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
