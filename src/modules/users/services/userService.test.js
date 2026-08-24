import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "../../../config/supabase";
import { userService } from "./userService";

vi.mock("../../../config/supabase", () => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
    rpc: vi.fn(),
  },
}));

describe("userService.actualizarCorreo", () => {
  let eqMock;
  let updateMock;

  beforeEach(() => {
    vi.clearAllMocks();
    eqMock = vi.fn().mockResolvedValue({ error: null });
    updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    supabase.from.mockReturnValue({ update: updateMock });
  });

  it("actualiza la fila del perfil por id con el correo recibido", async () => {
    await userService.actualizarCorreo("user-1", "maria@gmail.com");

    expect(supabase.from).toHaveBeenCalledWith("perfiles");
    expect(updateMock).toHaveBeenCalledWith({ correo: "maria@gmail.com" });
    expect(eqMock).toHaveBeenCalledWith("id", "user-1");
  });

  it("guarda null en vez de cadena vacía cuando se borra el correo", async () => {
    await userService.actualizarCorreo("user-1", "");

    expect(updateMock).toHaveBeenCalledWith({ correo: null });
  });

  it("propaga el error de Supabase", async () => {
    eqMock.mockResolvedValue({ error: { message: "RLS violation" } });

    await expect(
      userService.actualizarCorreo("user-1", "maria@gmail.com"),
    ).rejects.toThrow("Error al actualizar el correo: RLS violation");
  });
});

describe("userService.actualizarRol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invoca la RPC actualizar_rol_usuario con el id y el rol destino", async () => {
    supabase.rpc.mockResolvedValue({ data: { id: "user-1" }, error: null });

    await userService.actualizarRol("user-1", 2);

    expect(supabase.rpc).toHaveBeenCalledWith("actualizar_rol_usuario", {
      p_user_id: "user-1",
      p_rol_id: 2,
    });
  });

  it("propaga el mensaje de error de la RPC (ej. auto-modificación bloqueada)", async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "No puedes cambiar tu propio rol." },
    });

    await expect(userService.actualizarRol("user-1", 2)).rejects.toThrow(
      "Error al actualizar el rol: No puedes cambiar tu propio rol.",
    );
  });
});

describe("userService.crearUsuario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invoca la Edge Function create-user con el payload completo", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { message: "ok" },
      error: null,
    });

    const payload = {
      email: "maria.gomez@empresa.com",
      password: "abc123",
      nombre_usuario: "maria.gomez",
      nombre_completo: "María Gómez",
      rol_id: 3,
      correo: "maria@gmail.com",
    };

    await userService.crearUsuario(payload);

    expect(supabase.functions.invoke).toHaveBeenCalledWith("create-user", {
      body: payload,
    });
  });

  it("lanza un error si la Edge Function devuelve error de transporte", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: "network" },
    });

    await expect(userService.crearUsuario({})).rejects.toThrow(
      "Error de conexión con el servidor al intentar crear el usuario.",
    );
  });

  it("lanza el mensaje de negocio cuando la función responde con data.error", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { error: "El nombre de usuario ya existe." },
      error: null,
    });

    await expect(userService.crearUsuario({})).rejects.toThrow(
      "El nombre de usuario ya existe.",
    );
  });
});

describe("userService.resetearPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invoca reset-user-password con user_id y new_password", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { message: "Contraseña restablecida exitosamente." },
      error: null,
    });

    await userService.resetearPassword("user-1", "claveNueva123");

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "reset-user-password",
      { body: { user_id: "user-1", new_password: "claveNueva123" } },
    );
  });

  it("lanza un error si la Edge Function devuelve error de transporte", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: "network" },
    });

    await expect(
      userService.resetearPassword("user-1", "claveNueva123"),
    ).rejects.toThrow(
      "Error de conexión con el servidor al restablecer la contraseña.",
    );
  });

  it("lanza el mensaje de negocio cuando la función responde con data.error (ej. sin permiso)", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { error: "No tienes permiso para restablecer contraseñas." },
      error: null,
    });

    await expect(
      userService.resetearPassword("user-1", "claveNueva123"),
    ).rejects.toThrow("No tienes permiso para restablecer contraseñas.");
  });
});
