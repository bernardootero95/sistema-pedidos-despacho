import { useState, useEffect, useCallback } from "react";
import { companyService } from "../services/companyService";
import { CompanyLogoUploader } from "./CompanyLogoUploader";
import {
  validateCompanyField,
  validateCompanyForm,
} from "../utils/companyValidations";
import { useToast } from "../../../context/useToast";
import { Building2, Save, Loader2, ShieldAlert } from "lucide-react";

const FORM_VACIO = {
  razon_social: "",
  nombre_comercial: "",
  nit: "",
  digito_verificacion: "",
  direccion: "",
  ciudad: "",
  telefono: "",
  correo: "",
  resolucion_facturacion: "",
};

const CAMPOS = [
  { name: "razon_social", label: "Razón social *", span: "sm:col-span-2" },
  { name: "nombre_comercial", label: "Nombre comercial", span: "sm:col-span-2", ayuda: "Opcional. Si existe, se imprime como título y la razón social debajo." },
  { name: "nit", label: "NIT", span: "", placeholder: "900123456" },
  { name: "digito_verificacion", label: "DV", span: "", placeholder: "7" },
  { name: "direccion", label: "Dirección", span: "" },
  { name: "ciudad", label: "Ciudad", span: "" },
  { name: "telefono", label: "Teléfono", span: "" },
  { name: "correo", label: "Correo", span: "", type: "email" },
];

const claseInput = (error) =>
  `w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${
    error ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"
  }`;

/**
 * Datos del emisor que salen en el encabezado de pedidos y facturas
 * impresos, y el logo.
 */
export const CompanyDataSection = () => {
  const { showSuccess } = useToast();
  const [formData, setFormData] = useState(FORM_VACIO);
  const [logo, setLogo] = useState({ logoUrl: null, logoPath: null });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [serverError, setServerError] = useState("");

  const cargar = useCallback(() => {
    companyService
      .getDatosEmpresa()
      .then((datos) => {
        setFormData(
          Object.fromEntries(
            Object.keys(FORM_VACIO).map((campo) => [campo, datos[campo] || ""]),
          ),
        );
        setLogo({ logoUrl: datos.logoUrl, logoPath: datos.logo_path });
      })
      .catch((err) => setServerError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(cargar, [cargar]);

  const recargarLogo = () =>
    companyService
      .getDatosEmpresa()
      .then((datos) => setLogo({ logoUrl: datos.logoUrl, logoPath: datos.logo_path }))
      .catch((err) => setServerError(err.message));

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nuevo = { ...formData, [name]: value };
    setFormData(nuevo);
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateCompanyField(name, value, nuevo) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateCompanyField(name, value, formData) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const nuevosErrores = validateCompanyForm(formData);
    setErrors(nuevosErrores);
    setTouched(Object.fromEntries(Object.keys(formData).map((k) => [k, true])));
    if (Object.keys(nuevosErrores).length > 0) return;

    setGuardando(true);
    try {
      await companyService.actualizarDatosEmpresa(formData);
      showSuccess("Datos de la empresa guardados.");
    } catch (err) {
      setServerError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-slate-900">Datos de la empresa</p>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Encabezado de los pedidos y facturas impresos (tirilla y carta).
          </p>
        </div>
      </div>

      {serverError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm font-semibold">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{serverError}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando datos...
        </div>
      ) : (
        <>
          <CompanyLogoUploader
            logoUrl={logo.logoUrl}
            logoPath={logo.logoPath}
            onChange={recargarLogo}
          />

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {CAMPOS.map(({ name, label, span, ayuda, placeholder, type = "text" }) => (
                <div key={name} className={span}>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">{label}</label>
                  <input
                    type={type}
                    name={name}
                    value={formData[name]}
                    placeholder={placeholder}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={claseInput(errors[name])}
                  />
                  {errors[name] ? (
                    <p className="mt-1 text-xs text-red-500 font-bold">{errors[name]}</p>
                  ) : (
                    ayuda && <p className="mt-1 text-xs text-slate-400">{ayuda}</p>
                  )}
                </div>
              ))}
              <div className="sm:col-span-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Resolución de facturación DIAN
                </label>
                <textarea
                  name="resolucion_facturacion"
                  rows="2"
                  value={formData.resolucion_facturacion}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ej: Resolución DIAN N° 18764000000000 del 2026-01-01, prefijo FE del 1 al 5000, vigencia 24 meses."
                  className={claseInput(errors.resolucion_facturacion)}
                />
                {errors.resolucion_facturacion ? (
                  <p className="mt-1 text-xs text-red-500 font-bold">{errors.resolucion_facturacion}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Se imprime solo en las facturas electrónicas.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={guardando}
                className="px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2"
              >
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {guardando ? "Guardando..." : "Guardar datos"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};
