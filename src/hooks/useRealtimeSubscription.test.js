import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { supabase } from "../config/supabase";
import { useRealtimeSubscription } from "./useRealtimeSubscription";

vi.mock("../config/supabase", () => ({
  supabase: { channel: vi.fn(), removeChannel: vi.fn() },
}));

const buildChannel = () => {
  const channel = {};
  channel.on = vi.fn().mockReturnValue(channel);
  channel.subscribe = vi.fn().mockReturnValue(channel);
  return channel;
};

describe("useRealtimeSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("se suscribe a postgres_changes de la tabla indicada y llama subscribe()", () => {
    const channel = buildChannel();
    supabase.channel.mockReturnValue(channel);

    renderHook(() => useRealtimeSubscription("pedidos_cabecera", vi.fn()));

    expect(supabase.channel).toHaveBeenCalledTimes(1);
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "*",
        schema: "public",
        table: "pedidos_cabecera",
      }),
      expect.any(Function),
    );
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
  });

  it("pasa el filtro y el evento indicados a la config de postgres_changes", () => {
    const channel = buildChannel();
    supabase.channel.mockReturnValue(channel);

    renderHook(() =>
      useRealtimeSubscription("despachos_pedidos", vi.fn(), {
        filter: "despacho_id=eq.desp-1",
        event: "UPDATE",
      }),
    );

    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "UPDATE",
        table: "despachos_pedidos",
        filter: "despacho_id=eq.desp-1",
      }),
      expect.any(Function),
    );
  });

  it("invoca onChange con el payload cuando llega un evento", () => {
    const channel = buildChannel();
    supabase.channel.mockReturnValue(channel);
    const onChange = vi.fn();

    renderHook(() => useRealtimeSubscription("despachos", onChange));

    const callbackRegistrado = channel.on.mock.calls[0][2];
    const payload = {
      eventType: "UPDATE",
      new: { id: "d1", estado: "en_ruta" },
    };
    callbackRegistrado(payload);

    expect(onChange).toHaveBeenCalledWith(payload);
  });

  it("no se re-suscribe cuando solo cambia la identidad de onChange entre renders", () => {
    const channel = buildChannel();
    supabase.channel.mockReturnValue(channel);

    const { rerender } = renderHook(
      ({ onChange }) => useRealtimeSubscription("despachos", onChange),
      { initialProps: { onChange: vi.fn() } },
    );

    rerender({ onChange: vi.fn() });

    expect(supabase.channel).toHaveBeenCalledTimes(1);
    expect(supabase.removeChannel).not.toHaveBeenCalled();
  });

  it("se re-suscribe (limpia la anterior) cuando cambia la tabla", () => {
    supabase.channel.mockImplementation(() => buildChannel());

    const { rerender } = renderHook(
      ({ table }) => useRealtimeSubscription(table, vi.fn()),
      { initialProps: { table: "despachos" } },
    );

    rerender({ table: "pedidos_cabecera" });

    expect(supabase.channel).toHaveBeenCalledTimes(2);
    expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("limpia la suscripción al desmontar", () => {
    const channel = buildChannel();
    supabase.channel.mockReturnValue(channel);

    const { unmount } = renderHook(() =>
      useRealtimeSubscription("despachos", vi.fn()),
    );
    unmount();

    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("no crea ningún canal cuando enabled es false", () => {
    renderHook(() =>
      useRealtimeSubscription("despachos", vi.fn(), { enabled: false }),
    );

    expect(supabase.channel).not.toHaveBeenCalled();
  });
});
