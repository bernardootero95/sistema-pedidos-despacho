import { describe, it, expect } from "vitest";
import { MENU_ITEMS, getMenuVisible } from "./menuItems";

const etiquetas = (items) => items.map((item) => item.label);
const hijos = (items, key) =>
  etiquetas(items.find((item) => item.key === key)?.children ?? []);

describe("getMenuVisible", () => {
  it("sin rol no muestra nada", () => {
    expect(getMenuVisible(MENU_ITEMS, undefined)).toEqual([]);
  });

  it("soporte ve ambos grupos con todos sus hijos", () => {
    const menu = getMenuVisible(MENU_ITEMS, "soporte");

    expect(hijos(menu, "terceros")).toEqual(["Clientes", "Proveedores"]);
    expect(hijos(menu, "configuracion")).toEqual([
      "Datos Empresa",
      "Gestión de Personal",
      "Flota de Vehículos",
      "Tipos de Precio",
      "Pagos y Facturación",
    ]);
  });

  it("soporte y gerencia ven el grupo Bodega con los informes de inventario y la toma física", () => {
    ["soporte", "gerencia"].forEach((rol) => {
      expect(hijos(getMenuVisible(MENU_ITEMS, rol), "bodega")).toEqual([
        "Inv. por Rango",
        "Inv. Actual",
        "Toma Física",
      ]);
    });
  });

  it("despachador y vendedor no ven el grupo Bodega", () => {
    ["despachador", "vendedor"].forEach((rol) => {
      expect(etiquetas(getMenuVisible(MENU_ITEMS, rol))).not.toContain("Bodega");
    });
  });

  it("despachador ve Proveedores dentro de Terceros y no ve Configuración", () => {
    const menu = getMenuVisible(MENU_ITEMS, "despachador");

    expect(hijos(menu, "terceros")).toEqual(["Proveedores"]);
    expect(etiquetas(menu)).not.toContain("Configuración");
  });

  it("vendedor no ve ningún grupo", () => {
    const menu = getMenuVisible(MENU_ITEMS, "vendedor");

    expect(etiquetas(menu)).not.toContain("Terceros");
    expect(etiquetas(menu)).not.toContain("Configuración");
    expect(etiquetas(menu)).toContain("Toma de Pedidos");
  });

  it("repartidor solo ve su panel, su ruta y el instructivo", () => {
    const menu = getMenuVisible(MENU_ITEMS, "repartidor");

    expect(etiquetas(menu)).toEqual(["Panel Principal", "Mi Ruta de Hoy", "Instructivo"]);
  });
});
