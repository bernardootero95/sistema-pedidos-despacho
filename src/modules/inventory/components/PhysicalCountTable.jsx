import { formatMoneda } from "../../reports/utils/salesReportFormat";
import { formatCantidad } from "../../reports/utils/profitReportFormat";
import { diferenciaFila } from "../utils/physicalCountCalc";

const claseDiferencia = (diferencia) => {
  if (diferencia === null || diferencia === 0) return "text-slate-500";
  return diferencia < 0 ? "text-red-600" : "text-emerald-700";
};

/**
 * Filas de la toma con el campo de conteo. En una toma en curso el conteo es
 * editable y la diferencia se calcula al vuelo; en una aplicada se muestra lo
 * que se ajustó realmente. Presentación pura: el estado vive en
 * usePhysicalCount.
 */
export const PhysicalCountTable = ({ lineas, digitados, contados, errors, editable, onDigitar, onBlur }) => {
  if (lineas.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
        No hay productos que coincidan con el filtro.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-sm">
            <th className="p-4 whitespace-nowrap">Código</th>
            <th className="p-4">Producto</th>
            <th className="p-4 text-right">Sistema</th>
            <th className="p-4 text-right">Contado</th>
            <th className="p-4 text-right">Diferencia</th>
            <th className="p-4 text-right whitespace-nowrap">Valor a costo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm">
          {lineas.map((linea) => {
            const contado = contados[linea.productoId];
            const diferencia = editable ? diferenciaFila(linea.cantidadSistema, contado) : linea.diferencia;
            const mensaje = errors[linea.productoId];
            const texto = digitados[linea.productoId] ?? (contado === null ? "" : String(contado));

            return (
              <tr key={linea.productoId} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 text-slate-600">{linea.codigo}</td>
                <td className="p-4 font-medium text-slate-800 max-w-xs truncate" title={linea.nombre}>
                  {linea.nombre}
                </td>
                <td className="p-4 text-right text-slate-700">{formatCantidad(linea.cantidadSistema)}</td>
                <td className="p-3 text-right">
                  {editable ? (
                    <div className="flex flex-col items-end">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={texto}
                        placeholder="—"
                        aria-label={`Cantidad contada de ${linea.nombre}`}
                        aria-invalid={Boolean(mensaje)}
                        onChange={(e) => onDigitar(linea.productoId, e.target.value)}
                        onBlur={(e) => onBlur(linea.productoId, e.target.value)}
                        className={`w-28 px-3 py-2 border rounded-lg outline-none text-sm text-right bg-white ${
                          mensaje
                            ? "border-red-400 focus:ring-2 focus:ring-red-200"
                            : "border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        }`}
                      />
                      {mensaje && <p className="text-xs text-red-600 mt-1">{mensaje}</p>}
                    </div>
                  ) : (
                    <span className="text-slate-700">{contado === null ? "—" : formatCantidad(contado)}</span>
                  )}
                </td>
                <td className={`p-4 text-right font-semibold ${claseDiferencia(diferencia)}`}>
                  {diferencia === null ? "—" : `${diferencia > 0 ? "+" : ""}${formatCantidad(diferencia)}`}
                </td>
                <td className={`p-4 text-right whitespace-nowrap ${claseDiferencia(diferencia)}`}>
                  {diferencia === null ? "—" : formatMoneda(diferencia * (linea.costoUnitario ?? 0))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
