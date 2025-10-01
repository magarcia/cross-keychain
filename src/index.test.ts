import { describe, it, expect, beforeEach, vi } from "vitest";

describe("index - Public API", () => {
  let mod: typeof import("./index.js");

  beforeEach(async () => {
    vi.resetModules();
    mod = await import("./index.js");
    mod.__resetKeyringStateForTests();
  });

  describe("listBackends", () => {
    it("returns list of available backends with metadata", async () => {
      const backends = await mod.listBackends();

      expect(Array.isArray(backends)).toBe(true);
      expect(backends.length).toBeGreaterThan(0);

      backends.forEach((backend) => {
        expect(backend).toHaveProperty("id");
        expect(backend).toHaveProperty("name");
        expect(backend).toHaveProperty("priority");
        expect(typeof backend.id).toBe("string");
        expect(typeof backend.name).toBe("string");
        expect(typeof backend.priority).toBe("number");
      });
    });

    it("includes null and file backends by default", async () => {
      const backends = await mod.listBackends();
      const ids = backends.map((b) => b.id);

      expect(ids).toContain("null");
      expect(ids).toContain("file");
    });
  });

  describe("useBackend", () => {
    it("sets the specified backend as active", async () => {
      await mod.useBackend("null");

      const backend = await mod.getKeyring();
      expect(backend.id).toBe("null");
    });

    it("throws NoKeyringError when backend is not available", async () => {
      await expect(mod.useBackend("non-existent-backend")).rejects.toThrow(
        "Backend non-existent-backend is not available",
      );
    });

    it("supports backend configuration overrides", async () => {
      await mod.useBackend("file", { file_path: "/custom/path.json" });

      const backend = await mod.getKeyring();
      expect(backend.id).toBe("file");
    });
  });

  describe("diagnose", () => {
    it("returns diagnostic information including backend details", async () => {
      const info = await mod.diagnose();

      expect(info).toHaveProperty("configPath");
      expect(info).toHaveProperty("dataRoot");
      expect(info).toHaveProperty("id");
      expect(info).toHaveProperty("name");
      expect(info).toHaveProperty("priority");
      expect(typeof info.configPath).toBe("string");
      expect(typeof info.dataRoot).toBe("string");
    });
  });

  describe("configRoot and dataRoot", () => {
    it("returns config root path", () => {
      const path = mod.configRoot();
      expect(typeof path).toBe("string");
      expect(path.length).toBeGreaterThan(0);
    });

    it("returns data root path", () => {
      const path = mod.dataRoot();
      expect(typeof path).toBe("string");
      expect(path.length).toBeGreaterThan(0);
    });
  });
});
