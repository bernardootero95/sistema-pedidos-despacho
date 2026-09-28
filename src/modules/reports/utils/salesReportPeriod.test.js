import { describe, expect, it } from "vitest";
import { calcularRangoInforme, fechaLocalISO, obtenerCategoriasDetalle } from "./salesReportPeriod";
import { validateSalesReportFilters } from "./salesReportValidations";

describe("calcularRangoInforme", () => {
  it("usa el mismo día como inicio y fin en el informe diario", () => {
    expect(calcularRangoInforme({ tipo: "diario", fecha: "2026-09-28", mes: "2026-09" })).toEqual({
      fechaDesde: "2026-09-28",
      fechaHasta: "2026-09-28",
    });
  });

  it("cubre el mes completo en el cierre mensual, incluido febrero bisiesto", () => {
    expect(calcularRangoInforme({ tipo: "mensual", mes: "2026-09" })).toEqual({
      fechaDesde: "2026-09-01",
      fechaHasta: "2026-09-30",
    });
    expect(calcularRangoInforme({ tipo: "mensual", mes: "2028-02" }).fechaHasta).toBe("2028-02-29");
    expect(calcularRangoInforme({ tipo: "mensual", mes: "2026-12" }).fechaHasta).toBe("2026-12-31");
  });
});

describe("obtenerCategoriasDetalle", () => {
  it("rotula los pendientes según el tipo de informe", () => {
    const labels = (tipo) => obtenerCategoriasDetalle(tipo).map((c) => c.label);
    expect(labels("diario")).toContain("Pendientes de días anteriores");
    expect(labels("mensual")).toContain("Pendientes de meses anteriores");
  });
});

describe("validateSalesReportFilters", () => {
  it("exige solo el campo del tipo elegido", () => {
    expect(validateSalesReportFilters({ tipo: "diario", fecha: "", mes: "" })).toEqual({
      fecha: "La fecha es obligatoria.",
    });
    expect(validateSalesReportFilters({ tipo: "mensual", fecha: "", mes: "" })).toEqual({
      mes: "El mes es obligatorio.",
    });
  });

  it("rechaza períodos futuros", () => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    expect(validateSalesReportFilters({ tipo: "diario", fecha: fechaLocalISO(manana) }).fecha).toBe(
      "La fecha no puede ser futura.",
    );
    expect(validateSalesReportFilters({ tipo: "mensual", mes: "2999-01" }).mes).toBe("El mes no puede ser futuro.");
  });

  it("acepta hoy y el mes en curso", () => {
    expect(validateSalesReportFilters({ tipo: "diario", fecha: fechaLocalISO() })).toEqual({});
  });
});
