import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Sentry from "@sentry/react";
import { initSentry } from "./sentry";

vi.mock("@sentry/react", () => ({ init: vi.fn() }));

describe("initSentry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("no inicializa Sentry si VITE_SENTRY_DSN no está configurado", () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");

    initSentry();

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("inicializa Sentry con el DSN configurado", () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://fake@o0.ingest.sentry.io/1");

    initSentry();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: "https://fake@o0.ingest.sentry.io/1" }),
    );
  });

  it("no envía información personal identificable por defecto", () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://fake@o0.ingest.sentry.io/1");

    initSentry();

    const [[config]] = Sentry.init.mock.calls;
    expect(config.sendDefaultPii).toBe(false);
  });

  it("etiqueta los eventos con el dominio del tenant", () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://fake@o0.ingest.sentry.io/1");
    vi.stubEnv("VITE_COMPANY_DOMAIN", "distintoz.local");

    initSentry();

    const [[config]] = Sentry.init.mock.calls;
    expect(config.initialScope.tags.tenant).toBe("distintoz.local");
  });

  it("usa un tenant de reserva si VITE_COMPANY_DOMAIN no está configurado", () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://fake@o0.ingest.sentry.io/1");
    vi.stubEnv("VITE_COMPANY_DOMAIN", "");

    initSentry();

    const [[config]] = Sentry.init.mock.calls;
    expect(config.initialScope.tags.tenant).toBe("sin-tenant");
  });
});
