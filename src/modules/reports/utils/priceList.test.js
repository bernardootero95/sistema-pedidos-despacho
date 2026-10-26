import { describe, expect, it } from "vitest";
import { armarListaPrecios, categoriasDeLista, filtrarListaPrecios, formatEscalas } from "./priceList";

const productos = [
  { id: "p1", codigo: "001", nombre: "Arroz", categoria: "Granos", precio_venta: "5000.00" },
  { id: "p2", codigo: "002", nombre: "Gaseosa", categoria: "Bebidas", precio_venta: 3000 },
  { id: "p3", codigo: "003", nombre: "Hielo", categoria: null, precio_venta: 2000 },
];
const tipos = [
  { id: "t1", nombre: "Crédito", roles_permitidos: ["soporte"] },
  { id: "t2", nombre: "Frío" },
];

describe("armarListaPrecios", () => {
  const { tipos: columnas, filas } = armarListaPrecios({
    productos,
    tipos,
    preciosTipo: [
      { producto_id: "p2", tipo_precio_id: "t2", precio: 3500 },
      { producto_id: "p1", tipo_precio_id: "t1", precio: 5500 },
    ],
    mayoristas: [
      { producto_id: "p1", cantidad_minima: 24, precio: "4500.00" },
      { producto_id: "p1", cantidad_minima: 12, precio: "4800.00" },
    ],
  });

  it("deja una columna por tipo, solo con id y nombre", () => {
    expect(columnas).toEqual([
      { id: "t1", nombre: "Crédito" },
      { id: "t2", nombre: "Frío" },
    ]);
  });

  it("asigna el precio de cada tipo y null donde el producto no lo tiene", () => {
    expect(filas[0].preciosTipo).toEqual({ t1: 5500, t2: null });
    expect(filas[1].preciosTipo).toEqual({ t1: null, t2: 3500 });
    expect(filas[2].preciosTipo).toEqual({ t1: null, t2: null });
  });

  it("convierte los numéricos y ordena las escalas por cantidad mínima", () => {
    expect(filas[0].precioVenta).toBe(5000);
    expect(filas[0].escalas).toEqual([
      { cantidadMinima: 12, precio: 4800 },
      { cantidadMinima: 24, precio: 4500 },
    ]);
    expect(filas[1].escalas).toEqual([]);
    expect(filas[2].categoria).toBe("");
  });
});

describe("filtros de la lista", () => {
  const { filas } = armarListaPrecios({ productos, tipos: [], preciosTipo: [], mayoristas: [] });

  it("lista las categorías sin vacías ni repetidas, ordenadas", () => {
    expect(categoriasDeLista(filas)).toEqual(["Bebidas", "Granos"]);
  });

  it("filtra por código o nombre y por categoría", () => {
    expect(filtrarListaPrecios(filas, { busqueda: "gas" }).map((f) => f.codigo)).toEqual(["002"]);
    expect(filtrarListaPrecios(filas, { busqueda: "003" }).map((f) => f.nombre)).toEqual(["Hielo"]);
    expect(filtrarListaPrecios(filas, { categoria: "Granos" }).map((f) => f.nombre)).toEqual(["Arroz"]);
    expect(filtrarListaPrecios(filas, { busqueda: "arroz", categoria: "Bebidas" })).toEqual([]);
    expect(filtrarListaPrecios(filas)).toHaveLength(3);
  });
});

describe("formatEscalas", () => {
  it("une las escalas con su cantidad mínima", () => {
    const texto = formatEscalas([
      { cantidadMinima: 12, precio: 4800 },
      { cantidadMinima: 24, precio: 4500 },
    ]);
    expect(texto).toMatch(/^12\+: .*4\.800 · 24\+: .*4\.500$/);
  });

  it("devuelve vacío sin escalas", () => {
    expect(formatEscalas([])).toBe("");
  });
});
