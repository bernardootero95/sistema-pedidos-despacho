import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as Sentry from "@sentry/react";
import { ErrorBoundary } from "./ErrorBoundary";

vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));

const Throws = () => {
  throw new Error("boom");
};

const originalLocation = window.location;

describe("ErrorBoundary", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();

    // React también loguea el error de render por su cuenta en modo dev;
    // silenciamos consola para no ensuciar la salida del test, pero
    // seguimos pudiendo inspeccionar las llamadas del spy.
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    delete window.location;
    window.location = { ...originalLocation, reload: vi.fn(), assign: vi.fn() };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    window.location = originalLocation;
  });

  it("renderiza los hijos normalmente cuando no hay error", () => {
    render(
      <ErrorBoundary>
        <p>Contenido normal</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Contenido normal")).toBeInTheDocument();
  });

  it("muestra la UI de fallback cuando un hijo lanza un error de render", () => {
    render(
      <ErrorBoundary>
        <Throws />
      </ErrorBoundary>,
    );

    expect(
      screen.getByText("Ocurrió un error inesperado"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Contenido normal")).not.toBeInTheDocument();
  });

  it("loguea el error capturado para diagnóstico", () => {
    render(
      <ErrorBoundary>
        <Throws />
      </ErrorBoundary>,
    );

    const logueoPropio = consoleErrorSpy.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0].includes("[ErrorBoundary]"),
    );
    expect(logueoPropio).toBe(true);
  });

  it("el botón Recargar llama a window.location.reload", () => {
    render(
      <ErrorBoundary>
        <Throws />
      </ErrorBoundary>,
    );

    screen.getByText("Recargar").click();

    expect(window.location.reload).toHaveBeenCalled();
  });

  it("reporta el error capturado a Sentry", () => {
    render(
      <ErrorBoundary>
        <Throws />
      </ErrorBoundary>,
    );

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    const [error] = Sentry.captureException.mock.calls[0];
    expect(error.message).toBe("boom");
  });

  it("el botón Volver al inicio navega a la raíz", () => {
    render(
      <ErrorBoundary>
        <Throws />
      </ErrorBoundary>,
    );

    screen.getByText("Volver al inicio").click();

    expect(window.location.assign).toHaveBeenCalledWith("/");
  });
});
