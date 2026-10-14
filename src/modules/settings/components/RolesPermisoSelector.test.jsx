import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RolesPermisoSelector } from "./RolesPermisoSelector";
import { ROLES_PRECIO_MANUAL } from "../utils/permisosRoles";

const montar = (roles, onChange = vi.fn()) =>
  render(
    <RolesPermisoSelector
      titulo="Permiso"
      descripcion="Quién puede"
      catalogo={ROLES_PRECIO_MANUAL}
      roles={roles}
      guardando={false}
      onChange={onChange}
    />,
  );

describe("RolesPermisoSelector", () => {
  it("guarda al marcar otro perfil", () => {
    const onChange = vi.fn();
    montar(["soporte", "gerencia"], onChange);

    expect(screen.getByLabelText("Vendedor").checked).toBe(false);
    fireEvent.click(screen.getByLabelText("Vendedor"));
    expect(onChange).toHaveBeenCalledWith(["soporte", "gerencia", "vendedor"]);
  });

  it("muestra soporte y gerencia siempre marcados y fijos", () => {
    montar(["soporte", "gerencia"]);

    const soporte = screen.getByLabelText("Soporte");
    expect(soporte.checked).toBe(true);
    expect(soporte.disabled).toBe(true);
    expect(screen.getByLabelText("Gerencia").disabled).toBe(true);
  });
});
