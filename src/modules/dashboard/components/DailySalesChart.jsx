import { TrendingUp } from "lucide-react";

const ANCHO = 700;
const ALTO = 230;
const PADDING_IZQ = 8;
const PADDING_DER = 8;
const ALTO_BARRAS = 150;
const ALTO_ETIQUETAS_VALOR = 46;

const formatCurrencyCorta = (valor) => {
  if (valor >= 1_000_000) return `$${(valor / 1_000_000).toFixed(1)}M`;
  if (valor >= 1_000) return `$${Math.round(valor / 1_000)}K`;
  return `$${Math.round(valor)}`;
};

const formatFechaCorta = (fechaISO) =>
  new Date(`${fechaISO}T00:00:00`).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  });

/**
 * Gráfico de barras agrupadas (venta real vs preventa) en SVG puro (sin
 * librería de charts nueva: la serie son 30 puntos x 2 series, no justifica
 * sumar una dependencia al proyecto).
 *
 * Recibe `datos` = [{ fecha: 'YYYY-MM-DD', ventaReal: number, preventa:
 * number }, ...] ya ordenado ascendente, tal como lo devuelve
 * obtener_ventas_diarias. El valor de cada barra se dibuja siempre encima
 * (rotado, para que quepa en el ancho angosto de una barra diaria) en vez de
 * depender solo del tooltip nativo del <title>.
 */
export const DailySalesChart = ({ datos, formatCurrency }) => {
  const maximo = Math.max(1, ...datos.map((d) => Math.max(d.ventaReal, d.preventa)));
  const anchoUtil = ANCHO - PADDING_IZQ - PADDING_DER;
  const anchoGrupo = anchoUtil / datos.length;
  const anchoBarra = anchoGrupo * 0.36;

  // Etiquetas del eje X: solo algunas fechas para no amontonar el texto.
  const paso = Math.ceil(datos.length / 6);

  const sinDatos = datos.every((d) => d.ventaReal === 0 && d.preventa === 0);

  const renderBarra = (valor, x, color) => {
    const altura = valor > 0 ? Math.max(2, (valor / maximo) * ALTO_BARRAS) : 0;
    const y = ALTO_BARRAS - altura;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={anchoBarra}
          height={altura}
          rx={2}
          className={color}
        >
          <title>{formatCurrency(valor)}</title>
        </rect>
        {valor > 0 && (
          <text
            x={x + anchoBarra / 2}
            y={y - 4}
            textAnchor="start"
            transform={`rotate(-60 ${x + anchoBarra / 2} ${y - 4})`}
            className="fill-slate-500 text-[8px] font-medium"
          >
            {formatCurrencyCorta(valor)}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Venta Real vs Preventa Diaria
          </h3>
          <p className="text-xs text-slate-500">Últimos 30 días</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            Venta Real
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" />
            Preventa
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {sinDatos ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Sin ventas registradas en los últimos 30 días.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${ANCHO} ${ALTO}`}
            className="w-full h-56"
            role="img"
            aria-label="Venta real y preventa diaria de los últimos 30 días"
          >
            <g transform={`translate(0 ${ALTO_ETIQUETAS_VALOR})`}>
              {datos.map((punto, i) => {
                const xGrupo = PADDING_IZQ + i * anchoGrupo;
                const mostrarEtiquetaFecha = i % paso === 0;

                return (
                  <g key={punto.fecha}>
                    {renderBarra(
                      punto.ventaReal,
                      xGrupo + anchoGrupo * 0.08,
                      "fill-emerald-500 hover:fill-emerald-600 transition-colors",
                    )}
                    {renderBarra(
                      punto.preventa,
                      xGrupo + anchoGrupo * 0.08 + anchoBarra + 2,
                      "fill-sky-400 hover:fill-sky-500 transition-colors",
                    )}
                    {mostrarEtiquetaFecha && (
                      <text
                        x={xGrupo + anchoGrupo / 2}
                        y={ALTO_BARRAS + 18}
                        textAnchor="middle"
                        className="fill-slate-400 text-[9px]"
                      >
                        {formatFechaCorta(punto.fecha)}
                      </text>
                    )}
                  </g>
                );
              })}
              <line
                x1={PADDING_IZQ}
                y1={ALTO_BARRAS}
                x2={ANCHO - PADDING_DER}
                y2={ALTO_BARRAS}
                className="stroke-slate-200"
                strokeWidth={1}
              />
            </g>
          </svg>
        )}
      </div>
    </div>
  );
};
