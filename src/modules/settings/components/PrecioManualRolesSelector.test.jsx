import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrecioManualRolesSelector } from "./PrecioManualRolesSelector";

describe("PrecioManualRolesSelector", () => {
  it("marca los perfiles autorizados y guarda al marcar otro", () => {
    const onChange = vi.fn();
    render(<PrecioManualRolesSelector roles={["soporte", "gerencia"]} guardando={false} onChange={onChange} />);

    expect(screen.getByLabelText("Soporte").checked).toBe(true);
    expect(screen.getByLabelText("Vendedor").checked).toBe(false);

    fireEvent.click(screen.getByLabelText("Vendedor"));
    expect(onChange).toHaveBeenCalledWith(["soporte", "gerencia", "vendedor"]);
  });

  it("no deja quitar el último perfil y avisa", () => {
    const onChange = vi.fn();
    render(<PrecioManualRolesSelector roles={["gerencia"]} guardando={false} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Gerencia"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/al menos un perfil/i)).toBeTruthy();
  });
});
