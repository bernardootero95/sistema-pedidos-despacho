import { describe, it, expect } from "vitest";
import {
  estadoEfectivo,
  hoyIso,
  puedeAnularse,
  puedeConvertirse,
  sumarDiasIso,
} from "./quoteStatus";

describe("estadoEfectivo", () => {
  const hoy = "2026-10-03";

  it("vigente con vencimiento hoy o futuro sigue vigente", () => {
    expect(estadoEfectivo({ estado: "vigente", fecha_vencimiento: "2026-10-03" }, hoy)).toBe("vigente");
    expect(estadoEfectivo({ estado: "vigente", fecha_vencimiento: "2026-10-20" }, hoy)).toBe("vigente");
  });

  it("vigente con vencimiento pasado es vencida", () => {
    expect(estadoEfectivo({ estado: "vigente", fecha_vencimiento: "2026-10-02" }, hoy)).toBe("vencida");
  });

  it("convertida y anulada no se vuelven vencidas", () => {
    expect(estadoEfectivo({ estado: "convertida", fecha_vencimiento: "2026-01-01" }, hoy)).toBe("convertida");
    expect(estadoEfectivo({ estado: "anulada", fecha_vencimiento: "2026-01-01" }, hoy)).toBe("anulada");
  });
});

describe("permisos de acción", () => {
  const hoy = "2026-10-03";

  it("solo una vigente no vencida se convierte", () => {
    expect(puedeConvertirse({ estado: "vigente", fecha_vencimiento: "2026-10-10" }, hoy)).toBe(true);
    expect(puedeConvertirse({ estado: "vigente", fecha_vencimiento: "2026-10-01" }, hoy)).toBe(false);
    expect(puedeConvertirse({ estado: "convertida", fecha_vencimiento: "2026-10-10" }, hoy)).toBe(false);
    expect(puedeConvertirse({ estado: "anulada", fecha_vencimiento: "2026-10-10" }, hoy)).toBe(false);
  });

  it("anular aplica a vigentes (incluso vencidas), no a convertidas ni anuladas", () => {
    expect(puedeAnularse({ estado: "vigente" })).toBe(true);
    expect(puedeAnularse({ estado: "convertida" })).toBe(false);
    expect(puedeAnularse({ estado: "anulada" })).toBe(false);
  });
});

describe("fechas", () => {
  it("sumarDiasIso cruza meses y años", () => {
    expect(sumarDiasIso("2026-10-03", 15)).toBe("2026-10-18");
    expect(sumarDiasIso("2026-12-25", 10)).toBe("2027-01-04");
  });

  it("hoyIso usa la zona horaria de Bogotá", () => {
    // 2026-10-04 02:00 UTC = 2026-10-03 21:00 en Bogotá (UTC-5)
    expect(hoyIso(new Date("2026-10-04T02:00:00Z"))).toBe("2026-10-03");
  });
});
