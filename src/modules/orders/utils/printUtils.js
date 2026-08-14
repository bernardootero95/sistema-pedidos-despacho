// src/modules/orders/utils/printUtils.js

export const imprimirPedidoPdf = async (pedidoCompleto) => {
  if (!pedidoCompleto) return;

  const companyName = import.meta.env.VITE_COMPANY_NAME || "SISTEMA DE PEDIDOS";

  let subtotalGeneral = 0;
  let acumIva19 = 0;
  let acumIva5 = 0;
  let acumInc8 = 0;

  pedidoCompleto.detalles?.forEach((item) => {
    const subtotalLinea = Number(item.subtotal_linea) || 0;
    const porcIva = Math.round(Number(item.iva_porcentaje) || 0);
    const porcInc = Math.round(Number(item.inc_porcentaje) || 0);

    const factor = 1 + (porcIva + porcInc) / 100;
    const baseLinea = subtotalLinea / factor;

    subtotalGeneral += baseLinea;

    if (porcIva === 19) acumIva19 += baseLinea * (19 / 100);
    else if (porcIva === 5) acumIva5 += baseLinea * (5 / 100);
    if (porcInc === 8) acumInc8 += baseLinea * (8 / 100);
  });

  const clienteNombre =
    pedidoCompleto.clientes?.razon_social ||
    `${pedidoCompleto.clientes?.primer_nombre || ""} ${pedidoCompleto.clientes?.primer_apellido || ""}`;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Creamos el contenedor asegurando que el DOM lo procese físicamente
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.opacity = "0";
  container.style.pointerEvents = "none";
  container.style.zIndex = "-1000";

  container.innerHTML = `
    <div style="background-color: #ffffff; color: #000000; width: 72mm; padding: 12px; font-family: monospace; font-size: 11px; display: flex; flex-direction: column; gap: 10px;">
      <div style="text-align: center; padding-bottom: 8px; border-bottom: 1px dashed #000000;">
        <h3 style="font-weight: bold; font-size: 14px; text-transform: uppercase; margin: 0;">${companyName}</h3>
        <p style="font-weight: bold; font-size: 11px; text-transform: uppercase; margin: 2px 0;">COMPROBANTE DE DESPACHO</p>
        <p style="font-weight: bold; font-size: 13px; margin: 4px 0;">Pedido N°: ${pedidoCompleto.numero_pedido}</p>
        <p style="font-size: 10px; color: #333333; margin: 0;">Fecha: ${formatDate(pedidoCompleto.fecha_pedido)}</p>
      </div>

      <div style="padding-bottom: 8px; border-bottom: 1px dashed #000000; font-size: 10px; display: flex; flex-direction: column; gap: 2px;">
        <p style="margin: 0;"><strong>Cliente:</strong> ${clienteNombre}</p>
        <p style="margin: 0;"><strong>Tipo ID:</strong> ${pedidoCompleto.clientes?.tipo_identificacion || "NIT / CC"}</p>
        <p style="margin: 0;"><strong>N° Identificación:</strong> ${pedidoCompleto.clientes?.numero_identificacion}</p>
        <p style="margin: 0;"><strong>Dirección:</strong> ${pedidoCompleto.clientes?.direccion || "No registrada"}</p>
        <p style="margin: 0;"><strong>Vendedor:</strong> ${pedidoCompleto.vendedor?.nombre_completo}</p>
      </div>

      <div style="padding-bottom: 8px; border-bottom: 1px dashed #000000;">
        <div style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 4px; margin-bottom: 4px; font-size: 10px;">
          <span style="grid-column: span 2 / span 2; text-align: center;">CANT</span>
          <span style="grid-column: span 6 / span 6;">PRODUCTO</span>
          <span style="grid-column: span 4 / span 4; text-align: right;">TOTAL</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${pedidoCompleto.detalles
            ?.map(
              (item) => `
            <div style="display: flex; flex-direction: column; border-bottom: 1px solid #eeeeee; padding-bottom: 4px;">
              <div style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); font-size: 10px;">
                <span style="grid-column: span 2 / span 2; text-align: center; font-weight: bold;">${item.cantidad}</span>
                <span style="grid-column: span 6 / span 6; font-weight: 500;">${item.producto?.nombre}</span>
                <span style="grid-column: span 4 / span 4; text-align: right;">${formatCurrency(item.subtotal_linea)}</span>
              </div>
              <div style="font-size: 9px; padding-left: 8px; color: #555555;">V. Unit: ${formatCurrency(item.precio_unitario)}</div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>

      <div style="padding-bottom: 8px; border-bottom: 1px dashed #000000; display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
        <div style="display: flex; justify-content: space-between;"><span>SUBTOTAL:</span><span>${formatCurrency(subtotalGeneral)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>IVA 19%:</span><span>${formatCurrency(acumIva19)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>IVA 5%:</span><span>${formatCurrency(acumIva5)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>INC 8%:</span><span>${formatCurrency(acumInc8)}</span></div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; border-top: 1px solid #000000; padding-top: 4px; margin-top: 2px;">
          <span>TOTAL:</span><span>${formatCurrency(pedidoCompleto.total)}</span>
        </div>
      </div>

      ${
        pedidoCompleto.notas
          ? `
        <div style="padding-bottom: 8px; border-bottom: 1px dashed #000000; font-size: 10px;">
          <strong style="display: block;">Notas:</strong>
          <p style="margin: 0; font-style: italic;">${pedidoCompleto.notas}</p>
        </div>
      `
          : ""
      }

      <div style="text-align: center; font-size: 9px; color: #333333; display: flex; flex-direction: column; gap: 2px;">
        <p style="font-weight: bold; color: #000000; margin: 0;">¡Gracias por su compra!</p>
        <p style="font-size: 8px; margin: 0;">Sistema de pedidos y despacho desarrollado por TecnoIngenieria B.O.</p>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  const opt = {
    margin: 0,
    filename: `comprobante-pedido-${pedidoCompleto.numero_pedido}.pdf`,
    image: { type: "jpeg", quality: 1 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: [80, 200], orientation: "portrait" },
  };

  try {
    // Import dinámico: html2pdf.js (~900KB) solo se descarga cuando se
    // imprime un comprobante, no en el chunk inicial de cada página que
    // importa este util.
    const { default: html2pdf } = await import(
      "html2pdf.js/dist/html2pdf.min.js"
    );

    // Damos un pequeño respiro de 250ms para garantizar que el DOM pinte el contenido antes de convertir a PDF
    await new Promise((resolve) => setTimeout(resolve, 250));

    const pdfUrl = await html2pdf()
      .set(opt)
      .from(container.firstElementChild)
      .output("bloburl");
    window.open(pdfUrl, "_blank");
  } catch (error) {
    console.error("Error al generar el PDF térmico:", error);
    throw new Error("No se pudo generar el comprobante PDF.", {
      cause: error,
    });
  } finally {
    document.body.removeChild(container);
  }
};
