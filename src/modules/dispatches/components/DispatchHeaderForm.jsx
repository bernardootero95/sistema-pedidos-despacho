import { Truck, User, Calendar } from "lucide-react";

/**
 * Panel de datos logísticos del despacho: vehículo, conductor, fecha y
 * notas de ruta. Componente puramente de presentación (SRP): recibe el
 * estado y los manejadores desde el padre, no gestiona su propia lógica.
 */
export const DispatchHeaderForm = ({
  formData,
  errors,
  touched,
  onChange,
  onBlur,
  vehiculos,
  repartidores,
}) => {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
      <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <Truck className="w-5 h-5 text-blue-500" />
        Datos Logísticos
      </h2>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Fecha de Despacho *
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            <input
              type="date"
              name="fecha_despacho"
              value={formData.fecha_despacho}
              onChange={onChange}
              onBlur={onBlur}
              className={`w-full pl-9 border rounded-lg p-2.5 outline-none focus:ring-2 transition-colors ${
                touched.fecha_despacho && errors.fecha_despacho
                  ? "border-red-300 focus:ring-red-200"
                  : "border-slate-300 focus:ring-blue-100 focus:border-blue-500"
              }`}
            />
          </div>
          {touched.fecha_despacho && errors.fecha_despacho && (
            <p className="mt-1 text-xs text-red-500 font-semibold">
              {errors.fecha_despacho}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Vehículo Asignado *
          </label>
          <div className="relative">
            <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
            <select
              name="vehiculo_id"
              value={formData.vehiculo_id}
              onChange={onChange}
              onBlur={onBlur}
              className={`w-full pl-10 border rounded-lg p-2.5 outline-none focus:ring-2 appearance-none bg-white transition-colors ${
                touched.vehiculo_id && errors.vehiculo_id
                  ? "border-red-300 focus:ring-red-200"
                  : "border-slate-300 focus:ring-blue-100 focus:border-blue-500"
              }`}
            >
              <option value="">Seleccione un vehículo...</option>
              {vehiculos.map((v) => (
                <option key={v.id} value={v.id} disabled={v.enRutaActiva}>
                  {v.placa} - {v.marca}
                  {v.conductor
                    ? ` (Conductor habitual: ${v.conductor.nombre_completo})`
                    : ""}
                  {v.enRutaActiva ? " — EN RUTA ACTIVA" : ""}
                </option>
              ))}
            </select>
          </div>
          {touched.vehiculo_id && errors.vehiculo_id && (
            <p className="mt-1 text-xs text-red-500 font-semibold">
              {errors.vehiculo_id}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Conductor / Repartidor *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
            <select
              name="repartidor_id"
              value={formData.repartidor_id}
              onChange={onChange}
              onBlur={onBlur}
              className={`w-full pl-10 border rounded-lg p-2.5 outline-none focus:ring-2 appearance-none bg-white transition-colors ${
                touched.repartidor_id && errors.repartidor_id
                  ? "border-red-300 focus:ring-red-200"
                  : "border-slate-300 focus:ring-blue-100 focus:border-blue-500"
              }`}
            >
              <option value="">Seleccione el conductor...</option>
              {repartidores.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre_completo}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Se autocompleta con el conductor habitual del vehículo; puedes
            cambiarlo si un conductor sustituto tomará la ruta.
          </p>
          {touched.repartidor_id && errors.repartidor_id && (
            <p className="mt-1 text-xs text-red-500 font-semibold">
              {errors.repartidor_id}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Notas / Observaciones de Ruta
          </label>
          <textarea
            name="notas"
            value={formData.notas}
            onChange={onChange}
            placeholder="Instrucciones para el viaje..."
            rows="3"
            className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 resize-none"
          />
        </div>
      </div>
    </div>
  );
};
