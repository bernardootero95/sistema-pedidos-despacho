import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Sin `test.globals` en vite.config.js, RTL no detecta automáticamente
// `afterEach` para desmontar el DOM entre tests: hay que registrarlo a mano.
afterEach(() => {
  cleanup();
});
