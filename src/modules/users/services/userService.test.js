import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "../../../config/supabase";
import { userService } from "./userService";

vi.mock("../../../config/supabase", () => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
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
