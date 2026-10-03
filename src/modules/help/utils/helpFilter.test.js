import { describe, it, expect } from "vitest";
import { getSeccionesVisibles } from "./helpFilter";
import { SECCIONES_AYUDA } from "./helpContent";

const SECCIONES = [
  {
    id: "pedidos",
    titulo: "Toma de Pedidos",
    resumen: "Crear y anular pedidos.",
    roles: ["vendedor", "gerencia"],
    bloques: [
      { titulo: "Crear", pasos: ["Presiona Nuevo Pedido."] },
      { titulo: "Abonos", opcion: "abonosPedidosActivo", notas: ["Registra abonos."] },
      { titulo: "Factura", roles: ["gerencia"], notas: ["Emite la factura electrónica."] },
    ],
  },
  {
    id: "informes",
    titulo: "Informes",
    resumen: "Ventas y utilidad.",
    roles: ["gerencia"],
    bloques: [{ titulo: "Ventas", notas: ["Cierre de mes."] }],
  },
];

const ids = (secciones) => secciones.map((s) => s.id);
const titulosBloques = (seccion) => seccion.bloques.map((b) => b.titulo);

describe("getSeccionesVisibles", () => {
  it("sin rol no muestra nada", () => {
    expect(getSeccionesVisibles(SECCIONES, undefined, {})).toEqual([]);
  });

  it("omite secciones y bloques que el rol no puede usar", () => {
    const visibles = getSeccionesVisibles(SECCIONES, "vendedor", {});

    expect(ids(visibles)).toEqual(["pedidos"]);
    expect(titulosBloques(visibles[0])).toEqual(["Crear"]);
  });

  it("muestra los bloques que dependen de una opción solo si está encendida", () => {
    const apagada = getSeccionesVisibles(SECCIONES, "gerencia", { abonosPedidosActivo: false });
    const encendida = getSeccionesVisibles(SECCIONES, "gerencia", { abonosPedidosActivo: true });

    expect(titulosBloques(apagada[0])).not.toContain("Abonos");
    expect(titulosBloques(encendida[0])).toContain("Abonos");
  });

  it("si la búsqueda coincide con la sección la deja completa", () => {
    const visibles = getSeccionesVisibles(SECCIONES, "gerencia", {}, "informes");

    expect(ids(visibles)).toEqual(["informes"]);
    expect(titulosBloques(visibles[0])).toEqual(["Ventas"]);
  });

  it("si la búsqueda coincide solo con un bloque deja únicamente ese bloque", () => {
    const visibles = getSeccionesVisibles(SECCIONES, "gerencia", {}, "factura");

    expect(ids(visibles)).toEqual(["pedidos"]);
    expect(titulosBloques(visibles[0])).toEqual(["Factura"]);
  });

  it("busca sin distinguir mayúsculas ni tildes", () => {
    const visibles = getSeccionesVisibles(SECCIONES, "gerencia", {}, "ELECTRONICA");

    expect(titulosBloques(visibles[0])).toEqual(["Factura"]);
  });

  it("no expone a un rol el bloque restringido aunque la búsqueda coincida", () => {
    expect(getSeccionesVisibles(SECCIONES, "vendedor", {}, "factura")).toEqual([]);
  });

  it("el repartidor ve su ruta y no los módulos de oficina", () => {
    const visibles = ids(getSeccionesVisibles(SECCIONES_AYUDA, "repartidor", {}));

    expect(visibles).toContain("mi-ruta");
    expect(visibles).not.toContain("pedidos");
    expect(visibles).not.toContain("despachos");
  });

  it("todo bloque restringido por rol usa roles que tienen acceso a su sección", () => {
    SECCIONES_AYUDA.forEach((seccion) =>
      seccion.bloques
        .filter((bloque) => bloque.roles)
        .forEach((bloque) =>
          bloque.roles.forEach((rol) => expect(seccion.roles).toContain(rol)),
        ),
    );
  });
});
