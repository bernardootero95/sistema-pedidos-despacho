import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrecioManualEditor } from "./PrecioManualEditor";

const formatCurrency = (n) => `$${n}`;
const montar = (props = {}) => {
  const onGuardar = vi.fn();
  render(
    <PrecioManualEditor
      precio={1000}
      precioLista={1000}
      esManual={false}
      formatCurrency={formatCurrency}
      onGuardar={onGuardar}
      {...props}
    />,
  );
  return onGuardar;
};

describe("PrecioManualEditor", () => {
  it("muestra el precio y abre la edición con el lápiz", () => {
    montar();
    expect(screen.getByText("$1000 c/u")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Cambiar precio"));
    expect(screen.getByLabelText("Precio unitario").value).toBe("1000");
  });

  it("aplica el nuevo precio con Enter, aceptando coma decimal", () => {
    const onGuardar = montar();
    fireEvent.click(screen.getByLabelText("Cambiar precio"));
    const input = screen.getByLabelText("Precio unitario");
    fireEvent.change(input, { target: { value: "850,5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onGuardar).toHaveBeenCalledWith(850.5);
  });

  it("marca el error y no guarda un precio inválido", () => {
    const onGuardar = montar();
    fireEvent.click(screen.getByLabelText("Cambiar precio"));
    fireEvent.change(screen.getByLabelText("Precio unitario"), { target: { value: "-3" } });
    expect(screen.getByText(/precio válido/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Aplicar precio"));
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it("Escape cancela sin guardar", () => {
    const onGuardar = montar();
    fireEvent.click(screen.getByLabelText("Cambiar precio"));
    fireEvent.keyDown(screen.getByLabelText("Precio unitario"), { key: "Escape" });
    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText("$1000 c/u")).toBeTruthy();
  });

  it("indica el precio de lista cuando la línea tiene precio manual", () => {
    montar({ precio: 900, esManual: true });
    expect(screen.getByText(/Precio manual · lista \$1000/)).toBeTruthy();
  });
});
