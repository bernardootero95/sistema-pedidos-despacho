import { TrendingUp } from "lucide-react";

const ANCHO = 700;
const ALTO = 200;
const PADDING_IZQ = 8;
const PADDING_DER = 8;
const ALTO_BARRAS = 150;

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
 * Gráfico de barras liviano en SVG puro (sin librería de charts nueva: la
 * serie son 30 puntos, no justifica sumar una dependencia al proyecto).
 * Recibe `datos` = [{ fecha: 'YYYY-MM-DD', total: number }, ...] ya
 * ordenado ascendente, tal como lo devuelve obtener_ventas_diarias.
 */
export const DailySalesChart = ({ datos, formatCurrency }) => {
  const maximo = Math.max(1, ...datos.map((d) => d.total));
  const anchoUtil = ANCHO - PADDING_IZQ - PADDING_DER;
  const anchoBarra = anchoUtil / datos.length;

  // Etiquetas del eje X: solo algunas fechas para no amontonar el texto.
  const paso = Math.ceil(datos.length / 6);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Ventas Diarias
          </h3>
          <p className="text-xs text-slate-500">Últimos 30 días</p>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {datos.every((d) => d.total === 0) ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Sin ventas registradas en los últimos 30 días.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${ANCHO} ${ALTO}`}
            className="w-full h-44"
            role="img"
            aria-label="Ventas diarias de los últimos 30 días"
          >
            {datos.map((punto, i) => {
              const alturaBarra =
                punto.total > 0 ? Math.max(2, (punto.total / maximo) * ALTO_BARRAS) : 0;
              const x = PADDING_IZQ + i * anchoBarra;
              const y = ALTO_BARRAS - alturaBarra;
              const mostrarEtiqueta = i % paso === 0;

              return (
                <g key={punto.fecha}>
                  <rect
                    x={x + anchoBarra * 0.15}
                    y={y}
                    width={anchoBarra * 0.7}
                    height={alturaBarra}
                    rx={2}
                    className="fill-primary/80 hover:fill-primary transition-colors"
                  >
                    <title>
                      {formatFechaCorta(punto.fecha)}: {formatCurrency(punto.total)}
                    </title>
                  </rect>
                  {mostrarEtiqueta && (
                    <text
                      x={x + anchoBarra / 2}
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
            <text x={PADDING_IZQ} y={10} className="fill-slate-400 text-[9px]">
              {formatCurrencyCorta(maximo)}
            </text>
          </svg>
        )}
      </div>
    </div>
  );
};
