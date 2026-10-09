import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchableSelect } from "./SearchableSelect";

const opciones = [
  { value: "Bebidas", label: "Bebidas" },
  { value: "Aseo", label: "Aseo" },
];

const montar = (props = {}) => {
  const onChange = vi.fn();
  render(<SearchableSelect options={opciones} value="" onChange={onChange} placeholder="Elige" {...props} />);
  return { onChange, input: screen.getByPlaceholderText("Elige") };
};

describe("SearchableSelect (modo normal)", () => {
  it("no ofrece crear valores nuevos", () => {
    const { input } = montar();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Lacteos" } });
    expect(screen.queryByText(/Crear/)).toBeNull();
    expect(screen.getByText("Sin resultados.")).toBeTruthy();
  });
});

describe("SearchableSelect creatable", () => {
  it("lista las opciones existentes y elige una", () => {
    const { input, onChange } = montar({ creatable: true });
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByText("Aseo"));
    expect(onChange).toHaveBeenCalledWith("Aseo");
  });

  it("ofrece crear cuando lo escrito no existe y devuelve el texto nuevo", () => {
    const { input, onChange } = montar({ creatable: true });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "  Lácteos " } });
    fireEvent.mouseDown(screen.getByText('Crear "Lácteos"'));
    expect(onChange).toHaveBeenCalledWith("Lácteos");
  });

  it("no ofrece crear si ya existe, sin distinguir mayúsculas ni tildes", () => {
    const { input } = montar({ creatable: true });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "bebídas" } });
    expect(screen.queryByText(/Crear/)).toBeNull();
    expect(screen.getByText("Bebidas")).toBeTruthy();
  });

  it("al salir con un texto sin elegir lo conserva como valor nuevo", () => {
    const { input, onChange } = montar({ creatable: true });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Nuevo valor" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("Nuevo valor");
  });

  it("al salir con un texto que coincide usa la opción existente", () => {
    const { input, onChange } = montar({ creatable: true });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ASEO" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("Aseo");
  });

  it("vaciar el campo limpia el valor", () => {
    const { input, onChange } = montar({ creatable: true, value: "Aseo" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("muestra un valor actual que no está en la lista", () => {
    const { input } = montar({ creatable: true, value: "Heredado" });
    expect(input.value).toBe("Heredado");
  });

  it("limita lo que se puede escribir con maxLength", () => {
    const { input } = montar({ creatable: true, maxLength: 50 });
    expect(input.getAttribute("maxlength")).toBe("50");
  });
});
