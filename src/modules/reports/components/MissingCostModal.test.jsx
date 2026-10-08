import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MissingCostModal } from "./MissingCostModal";
import { productService } from "../../products/services/productService";

vi.mock("../../products/services/productService", () => ({
  productService: { asignarCostosProductos: vi.fn() },
}));

const productos = [
  { productoId: "a", codigo: "P-1", nombre: "Arroz", precioVenta: 3000 },
  { productoId: "b", codigo: "P-2", nombre: "Aceite", precioVenta: 9000 },
];

describe("MissingCostModal", () => {
  beforeEach(() => {
    productService.asignarCostosProductos.mockReset();
  });

  it("guarda solo las filas con costo digitado y acepta coma decimal", async () => {
    productService.asignarCostosProductos.mockResolvedValue({ guardados: 1 });
    const onGuardado = vi.fn();
    render(<MissingCostModal productos={productos} onGuardado={onGuardado} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText("Costo de Arroz"), { target: { value: "1250,5" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar costos/ }));

    await waitFor(() => expect(onGuardado).toHaveBeenCalled());
    expect(productService.asignarCostosProductos).toHaveBeenCalledWith([{ productoId: "a", costo: 1250.5 }]);
    expect(onGuardado.mock.calls[0][0].get("a")).toBe(1250.5);
  });

  it("no envía nada si hay un costo inválido y lo marca", async () => {
    render(<MissingCostModal productos={productos} onGuardado={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText("Costo de Arroz"), { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar costos/ }));

    expect(await screen.findByText("El costo no puede ser negativo.")).toBeTruthy();
    expect(productService.asignarCostosProductos).not.toHaveBeenCalled();
  });

  it("filtra los productos por búsqueda", () => {
    render(<MissingCostModal productos={productos} onGuardado={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText("Buscar producto"), { target: { value: "aceite" } });
    expect(screen.queryByLabelText("Costo de Arroz")).toBeNull();
    expect(screen.getByLabelText("Costo de Aceite")).toBeTruthy();
  });
});
