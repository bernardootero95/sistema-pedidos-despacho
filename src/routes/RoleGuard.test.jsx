import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RoleGuard } from "./RoleGuard";
import { useAuth } from "../context/useAuth";

vi.mock("../context/useAuth", () => ({ useAuth: vi.fn() }));

const renderConGuard = (roles, initialPath = "/protegido") => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RoleGuard roles={roles} />}>
          <Route path="/protegido" element={<div>Contenido protegido</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Panel Principal</div>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("RoleGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza la ruta protegida cuando el rol del usuario está autorizado", () => {
    useAuth.mockReturnValue({ user: { rol: "vendedor" } });

    renderConGuard(["vendedor", "gerencia"]);

    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  });

  it("redirige a /dashboard cuando el rol del usuario no está en la lista permitida", () => {
    useAuth.mockReturnValue({ user: { rol: "repartidor" } });

    renderConGuard(["gerencia", "soporte"]);

    expect(screen.getByText("Panel Principal")).toBeInTheDocument();
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  it("redirige a /dashboard cuando no hay usuario autenticado", () => {
    useAuth.mockReturnValue({ user: null });

    renderConGuard(["gerencia", "soporte", "vendedor", "despachador", "repartidor"]);

    expect(screen.getByText("Panel Principal")).toBeInTheDocument();
  });

  it("no autoriza cuando el rol no es exactamente igual a ninguno permitido (case-sensitive)", () => {
    useAuth.mockReturnValue({ user: { rol: "Vendedor" } });

    renderConGuard(["vendedor"]);

    expect(screen.getByText("Panel Principal")).toBeInTheDocument();
  });
});
