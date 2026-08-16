import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "../../../config/supabase";
import { authService } from "./authService";

vi.mock("../../../config/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
    auth: {
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

describe("authService.solicitarRecuperacionPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta tiene_correo_recuperacion con el nombre_usuario normalizado", async () => {
    supabase.rpc.mockResolvedValue({ data: false, error: null });

    await authService.solicitarRecuperacionPassword("  Maria.Gomez  ");

    expect(supabase.rpc).toHaveBeenCalledWith("tiene_correo_recuperacion", {
      p_nombre_usuario: "maria.gomez",
    });
  });

  it("no llama a resetPasswordForEmail si la cuenta no tiene correo habilitado", async () => {
    supabase.rpc.mockResolvedValue({ data: false, error: null });

    const resultado =
      await authService.solicitarRecuperacionPassword("maria.gomez");

    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(resultado).toEqual({ enviado: false });
  });

  it("llama a resetPasswordForEmail con el email sintético (no con el correo real)", async () => {
    supabase.rpc.mockResolvedValue({ data: true, error: null });
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });

    const resultado =
      await authService.solicitarRecuperacionPassword("maria.gomez");

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      expect.stringMatching(/^maria\.gomez@/),
      expect.objectContaining({
        redirectTo: expect.stringContaining("/restablecer-password"),
      }),
    );
    expect(resultado).toEqual({ enviado: true });
  });

  it("lanza un error si falla la consulta del gate", async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    await expect(
      authService.solicitarRecuperacionPassword("maria.gomez"),
    ).rejects.toThrow("No se pudo verificar la cuenta");
  });

  it("lanza un error si falla el envío del correo", async () => {
    supabase.rpc.mockResolvedValue({ data: true, error: null });
    supabase.auth.resetPasswordForEmail.mockResolvedValue({
      error: { message: "smtp down" },
    });

    await expect(
      authService.solicitarRecuperacionPassword("maria.gomez"),
    ).rejects.toThrow("No se pudo enviar el enlace de recuperación.");
  });
});

describe("authService.actualizarPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("llama a supabase.auth.updateUser con la nueva contraseña", async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: null });

    const resultado = await authService.actualizarPassword("nuevaClave123");

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: "nuevaClave123",
    });
    expect(resultado).toBe(true);
  });

  it("propaga el mensaje de error de Supabase", async () => {
    supabase.auth.updateUser.mockResolvedValue({
      error: { message: "Sesión inválida o expirada." },
    });

    await expect(
      authService.actualizarPassword("nuevaClave123"),
    ).rejects.toThrow("Sesión inválida o expirada.");
  });
});
