import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { vehicleService } from "../services/vehicleService";
import {
  validateVehicleField,
  validateVehicleForm,
} from "../utils/vehicleValidations";
import {
  Save,
  ArrowLeft,
  ShieldAlert,
  Loader2,
  Truck,
  UserCheck,
} from "lucide-react";

export const VehicleFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    placa: "",
    marca: "",
    modelo: "",
    conductor_id: "",
    capacidad_peso: "",
    capacidad_volumen: "",
  });

  const [repartidores, setRepartidores] = useState([]);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        setLoading(true);

        // Cargar catálogo de repartidores en paralelo
        const repartidoresData = await vehicleService.getRepartidores();
        setRepartidores(repartidoresData);

        if (isEditing) {
          const { data, error } = await vehicleService.getVehiculoPorId(id);
          if (error) throw error;
          if (data) {
            setFormData({
              placa: data.placa || "",
              marca: data.marca || "",
              modelo: data.modelo || "",
              conductor_id: data.conductor_id || "",
              capacidad_peso: data.capacidad_peso ?? "",
              capacidad_volumen: data.capacidad_volumen ?? "",
            });
          }
        }
      } catch (err) {
        setServerError(`Error al cargar datos: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    cargarDatosIniciales();
  }, [id, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const finalValue = name === "placa" ? value.toUpperCase() : value;

    setFormData((prev) => ({ ...prev, [name]: finalValue }));

    if (touched[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateVehicleField(name, finalValue),
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateVehicleField(name, value),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const formErrors = validateVehicleForm(formData);
    setErrors(formErrors);
    setTouched({
      placa: true,
      marca: true,
      modelo: true,
      conductor_id: true,
      capacidad_peso: true,
      capacidad_volumen: true,
    });

    if (Object.keys(formErrors).length > 0) return;

    try {
      setIsSubmitting(true);

      const payload = {
        ...formData,
        marca: formData.marca.trim() || null,
        modelo: formData.modelo !== "" ? Number(formData.modelo) : null,
        conductor_id: formData.conductor_id || null,
        capacidad_peso:
          formData.capacidad_peso !== "" ? Number(formData.capacidad_peso) : 0,
        capacidad_volumen:
          formData.capacidad_volumen !== ""
            ? Number(formData.capacidad_volumen)
            : 0,
      };

      if (isEditing) {
        await vehicleService.actualizarVehiculo(id, payload);
      } else {
        await vehicleService.crearVehiculo(payload);
      }

      navigate("/vehiculos");
    } catch (err) {
      setServerError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-500 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span>Cargando datos del módulo de vehículos...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Cabecera y Navegación */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/vehiculos")}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              {isEditing ? "Editar Vehículo" : "Registrar Nuevo Vehículo"}
            </h1>
            <p className="text-sm text-slate-500">
              {isEditing
                ? "Modifique los datos técnicos y el conductor asignado a la unidad."
                : "Ingrese la información para añadir una unidad a la flota."}
            </p>
          </div>
        </div>
      </div>

      {/* Formulario Principal */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8 space-y-6"
      >
        {serverError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Placa */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Placa / Identificador *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Truck className="w-4 h-4" />
              </span>
              <input
                type="text"
                name="placa"
                value={formData.placa}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej: ABC123"
                className={`w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border uppercase tracking-widest font-semibold focus:outline-none transition-colors ${
                  touched.placa && errors.placa
                    ? "border-red-300 focus:border-red-500 bg-red-50/30 text-red-900"
                    : "border-slate-200 focus:border-blue-600 text-slate-800"
                }`}
              />
            </div>
            {touched.placa && errors.placa && (
              <span className="text-xs text-red-500 mt-1 block font-medium">
                {errors.placa}
              </span>
            )}
          </div>

          {/* Conductor / Repartidor Asignado */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Conductor (Repartidor)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <UserCheck className="w-4 h-4" />
              </span>
              <select
                name="conductor_id"
                value={formData.conductor_id}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-600 text-slate-800 bg-white focus:outline-none transition-colors"
              >
                <option value="">-- Sin conductor asignado --</option>
                {repartidores.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.nombre_completo} ({rep.nombre_usuario})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              Solo se muestran usuarios activos con rol Repartidor.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Marca */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Marca{" "}
              <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <input
              type="text"
              name="marca"
              value={formData.marca}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Ej: Chevrolet, Hino, Foton"
              className={`w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none transition-colors ${
                touched.marca && errors.marca
                  ? "border-red-300 focus:border-red-500 bg-red-50/30 text-red-900"
                  : "border-slate-200 focus:border-blue-600 text-slate-800"
              }`}
            />
            {touched.marca && errors.marca && (
              <span className="text-xs text-red-500 mt-1 block font-medium">
                {errors.marca}
              </span>
            )}
          </div>

          {/* Modelo (Año) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Modelo (Año){" "}
              <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <input
              type="number"
              name="modelo"
              value={formData.modelo}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Ej: 2024"
              className={`w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none transition-colors ${
                touched.modelo && errors.modelo
                  ? "border-red-300 focus:border-red-500 bg-red-50/30 text-red-900"
                  : "border-slate-200 focus:border-blue-600 text-slate-800"
              }`}
            />
            {touched.modelo && errors.modelo && (
              <span className="text-xs text-red-500 mt-1 block font-medium">
                {errors.modelo}
              </span>
            )}
          </div>

          {/* Capacidad de Peso (Opcional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Cap. Peso (kg){" "}
              <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <input
              type="number"
              step="0.01"
              name="capacidad_peso"
              value={formData.capacidad_peso}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Ej: 3500"
              className={`w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none transition-colors ${
                touched.capacidad_peso && errors.capacidad_peso
                  ? "border-red-300 focus:border-red-500 bg-red-50/30 text-red-900"
                  : "border-slate-200 focus:border-blue-600 text-slate-800"
              }`}
            />
            {touched.capacidad_peso && errors.capacidad_peso && (
              <span className="text-xs text-red-500 mt-1 block font-medium">
                {errors.capacidad_peso}
              </span>
            )}
          </div>
        </div>

        {/* Capacidad de Volumen (Opcional) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Cap. Volumen (m³){" "}
              <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <input
              type="number"
              step="0.01"
              name="capacidad_volumen"
              value={formData.capacidad_volumen}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Ej: 18.5"
              className={`w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none transition-colors ${
                touched.capacidad_volumen && errors.capacidad_volumen
                  ? "border-red-300 focus:border-red-500 bg-red-50/30 text-red-900"
                  : "border-slate-200 focus:border-blue-600 text-slate-800"
              }`}
            />
            {touched.capacidad_volumen && errors.capacidad_volumen && (
              <span className="text-xs text-red-500 mt-1 block font-medium">
                {errors.capacidad_volumen}
              </span>
            )}
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate("/vehiculos")}
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-200 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>
                  {isEditing ? "Actualizar Vehículo" : "Guardar Vehículo"}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
