import writeXlsxFile from "write-excel-file/node";
import { fileURLToPath } from "node:url";

const HEADER = ["cod_inv", "nom_inv", "existencia", "vtotal", "columna_extra"];

const filas = [
  HEADER,
  ["P001", "Producto Uno", 10, 5000, "ignorar"],
  ["P002", "Producto Dos", 3, 12000, "ignorar"],
  ["", "", "", "", ""],
  ["P003", "", 5, 1000, ""],
  ["P004", "Producto Cuatro", "no-numero", 1000, ""],
  ["P002", "Producto Dos Actualizado", 7, 12500, ""],
];

const data = filas.map((fila) =>
  fila.map((valor) => ({ value: valor === "" ? undefined : valor })),
);

await writeXlsxFile(data).toFile(
  fileURLToPath(new URL("./fixtures/productos-import.xlsx", import.meta.url)),
);

const filasSinColumna = [
  ["cod_inv", "nom_inv", "existencia"],
  ["P001", "Producto Uno", 10],
];
const dataSinColumna = filasSinColumna.map((fila) =>
  fila.map((valor) => ({ value: valor })),
);
await writeXlsxFile(dataSinColumna).toFile(
  fileURLToPath(
    new URL("./fixtures/productos-import-columna-faltante.xlsx", import.meta.url),
  ),
);

console.log("Fixtures generados.");
