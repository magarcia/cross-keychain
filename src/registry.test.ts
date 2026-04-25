import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SecretStorageBackend, Credential } from "./types.js";

describe("backend registry", () => {
  let mod: typeof import("./registry.js");
  let errors: typeof import("./errors.js");
  let backends: {
    NullBackend: typeof import("./backends/null.js").NullBackend;
    FileSystemBackend: typeof import("./backends/file.js").FileSystemBackend;
    NativeKeychainBackend: typeof import("./backends/native-macos.js").NativeKeychainBackend;
    NativeWindowsBackend: typeof import("./backends/native-windows.js").NativeWindowsBackend;
    NativeLinuxBackend: typeof import("./backends/native-linux.js").NativeLinuxBackend;
  };

  beforeEach(async () => {
    vi.resetModules();
    delete process.env.TS_KEYRING_BACKEND;
    delete process.env.TS_KEYRING_ALLOW_INSECURE_FALLBACKS;

    mod = await import("./registry.js");
    errors = await import("./errors.js");
    backends = {
      NullBackend: (await import("./backends/null.js")).NullBackend,
      FileSystemBackend: (await import("./backends/file.js")).FileSystemBackend,
      NativeKeychainBackend: (await import("./backends/native-macos.js"))
        .NativeKeychainBackend,
      NativeWindowsBackend: (await import("./backends/native-windows.js"))
        .NativeWindowsBackend,
      NativeLinuxBackend: (await import("./backends/native-linux.js"))
        .NativeLinuxBackend,
    };
    mod.__resetRegistryForTests();
  });

  function mockAllNativeBackendsUnavailable(): void {
    vi.spyOn(backends.NativeKeychainBackend, "isSupported").mockResolvedValue(
      false,
    );
    vi.spyOn(backends.NativeWindowsBackend, "isSupported").mockResolvedValue(
      false,
    );
    vi.spyOn(backends.NativeLinuxBackend, "isSupported").mockResolvedValue(
      false,
    );
  }

  describe("getAllBackends", () => {
    it("lists available backends", async () => {
      mockAllNativeBackendsUnavailable();

      const allBackends = await mod.getAllBackends();
      const ids = allBackends.map((backend) => backend.id);

      expect(ids).toContain("file");
      expect(ids).toContain("null");
    });

    it("skips backends whose construction fails with InitError", async () => {
      class ThrowingBackend implements SecretStorageBackend {
        public readonly id = "throw";
        public readonly name = "Throw";
        public readonly priority = 1;

        public constructor() {
          throw new errors.InitError("boom");
        }

        public async getPassword(): Promise<string | null> {
          return null;
        }
        public async setPassword(): Promise<void> {}
        public async deletePassword(): Promise<void> {}
        public async getCredential(): Promise<Credential | null> {
          return null;
        }
        public withProperties(): SecretStorageBackend {
          return this;
        }
        public async diagnose(): Promise<Record<string, unknown>> {
          return {};
        }
      }

      const throwingFactory = ThrowingBackend as unknown as {
        new (...args: unknown[]): SecretStorageBackend;
        prototype: SecretStorageBackend;
      };

      mod.registerBackend(throwingFactory);
      mod.__resetRegistryForTests();

      const allBackends = await mod.getAllBackends();
      expect(allBackends.some((backend) => backend.id === "throw")).toBe(false);
    });

    it("propagates unexpected backend construction failures", async () => {
      class ExplodingBackend implements SecretStorageBackend {
        public readonly id = "explode";
        public readonly name = "Exploder";
        public readonly priority = 0;

        public constructor() {
          throw new Error("kaboom");
        }

        public async getPassword(): Promise<string | null> {
          return null;
        }
        public async setPassword(): Promise<void> {}
        public async deletePassword(): Promise<void> {}
        public async getCredential(): Promise<Credential | null> {
          return null;
        }
        public withProperties(): SecretStorageBackend {
          return this;
        }
        public async diagnose(): Promise<Record<string, unknown>> {
          return {};
        }
      }

      const explodingFactory = ExplodingBackend as unknown as {
        new (...args: unknown[]): SecretStorageBackend;
        prototype: SecretStorageBackend;
      };

      mod.registerBackend(explodingFactory);
      mod.__resetRegistryForTests();

      await expect(mod.getAllBackends()).rejects.toThrow("kaboom");
    });
  });

  describe("detectBackend", () => {
    it("selects the backend with the highest priority", async () => {
      class HighPriorityBackend implements SecretStorageBackend {
        public readonly id = "high";
        public readonly name = "High priority";
        public readonly priority = 100;

        public static async isSupported(): Promise<boolean> {
          return true;
        }

        public async getPassword(): Promise<string | null> {
          return null;
        }
        public async setPassword(): Promise<void> {}
        public async deletePassword(): Promise<void> {}
        public async getCredential(): Promise<Credential | null> {
          return null;
        }
        public withProperties(): SecretStorageBackend {
          return this;
        }
        public async diagnose(): Promise<Record<string, unknown>> {
          return { id: this.id, name: this.name, priority: this.priority };
        }
      }

      const highFactory = HighPriorityBackend as unknown as {
        new (...args: unknown[]): SecretStorageBackend;
        prototype: SecretStorageBackend;
        isSupported?: () => boolean | Promise<boolean>;
      };

      mod.registerBackend(highFactory);
      mod.__resetRegistryForTests();

      await mod.initBackend();
      const backend = await mod.getKeyring();
      expect(backend.id).toBe("high");
    });

    it("falls back to null backend when limit excludes all", async () => {
      mockAllNativeBackendsUnavailable();

      await mod.initBackend(() => false);
      const backend = await mod.getKeyring();
      expect(backend.id).toBe("null");
    });
  });

  describe("initBackend", () => {
    it("respects BackendLimit", async () => {
      await mod.initBackend((backend) => backend.id === "null");
      const backend = await mod.getKeyring();
      expect(backend.id).toBe("null");
    });

    it("prevents using backends rejected by the active limit", async () => {
      await mod.initBackend((backend) => backend.id === "null");
      const backend = await mod.loadBackendById("file", (b) => b.id === "null");
      expect(backend).toBeNull();
    });

    it("fails when environment selects unavailable backend", async () => {
      process.env.TS_KEYRING_BACKEND = "missing";
      await expect(mod.initBackend()).rejects.toBeInstanceOf(errors.InitError);
    });

    it("loads backend from environment variable when valid", async () => {
      process.env.TS_KEYRING_BACKEND = "null";
      await mod.initBackend();
      const backend = await mod.getKeyring();
      expect(backend.id).toBe("null");
    });

    it("loads backend from config file", async () => {
      const configMod = await import("./config.js");
      vi.spyOn(configMod, "readConfig").mockResolvedValue({
        defaultBackend: "null",
        backendProperties: {},
      });

      await mod.initBackend();
      const backend = await mod.getKeyring();
      expect(backend.id).toBe("null");
    });

    it("loads backend from config file with properties", async () => {
      const configMod = await import("./config.js");
      vi.spyOn(configMod, "readConfig").mockResolvedValue({
        defaultBackend: "file",
        backendProperties: {
          file: { file_path: "/custom/path.json" },
        },
      });

      await mod.initBackend();
      const backend = await mod.getKeyring();
      expect(backend.id).toBe("file");
    });

    it("refuses insecure fallback backends by default", async () => {
      mockAllNativeBackendsUnavailable();

      await expect(mod.initBackend()).rejects.toBeInstanceOf(errors.InitError);
    });

    it("allows insecure fallback backends when env flag is enabled", async () => {
      mockAllNativeBackendsUnavailable();
      process.env.TS_KEYRING_ALLOW_INSECURE_FALLBACKS = "1";

      await mod.initBackend((backend) => ["file", "null"].includes(backend.id));
      const backend = await mod.getKeyring();
      expect(backend.id).toBe("file");
    });

    it("allows insecure fallback backends when config flag is enabled", async () => {
      mockAllNativeBackendsUnavailable();
      const configMod = await import("./config.js");
      vi.spyOn(configMod, "readConfig").mockResolvedValue({
        allowInsecureFallbacks: true,
      });

      await mod.initBackend((backend) => ["file", "null"].includes(backend.id));
      const backend = await mod.getKeyring();
      expect(backend.id).toBe("file");
    });

    it("gives env flag precedence over config flag", async () => {
      mockAllNativeBackendsUnavailable();
      process.env.TS_KEYRING_ALLOW_INSECURE_FALLBACKS = "true";
      const configMod = await import("./config.js");
      vi.spyOn(configMod, "readConfig").mockResolvedValue({
        allowInsecureFallbacks: false,
      });

      await mod.initBackend((backend) => ["file", "null"].includes(backend.id));
      const backend = await mod.getKeyring();
      expect(backend.id).toBe("file");
    });

    it("ignores config file when it does not exist", async () => {
      process.env.TS_KEYRING_ALLOW_INSECURE_FALLBACKS = "1";
      const configMod = await import("./config.js");
      const error = new Error("File not found") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      vi.spyOn(configMod, "readConfig").mockRejectedValue(error);

      await mod.initBackend();
      const backend = await mod.getKeyring();
      // Should fall back to platform detection
      expect(backend).toBeDefined();
    });

    it("propagates config file errors other than ENOENT", async () => {
      const configMod = await import("./config.js");
      const error = new Error("Permission denied") as NodeJS.ErrnoException;
      error.code = "EACCES";
      vi.spyOn(configMod, "readConfig").mockRejectedValue(error);

      await expect(mod.initBackend()).rejects.toThrow("Permission denied");
    });
  });

  describe("loadBackendById", () => {
    it("returns null when unknown backend is requested", async () => {
      const backend = await mod.loadBackendById("missing");
      expect(backend).toBeNull();
    });

    it("loads backend by id when available", async () => {
      const backend = await mod.loadBackendById("null");
      expect(backend).not.toBeNull();
      expect(backend?.id).toBe("null");
    });

    it("returns null when backend is filtered by limit", async () => {
      const backend = await mod.loadBackendById("file", (b) => b.id === "null");
      expect(backend).toBeNull();
    });
  });

  describe("registerBackend", () => {
    it("adds new backends to the registry", async () => {
      class CustomBackend implements SecretStorageBackend {
        public readonly id = "custom";
        public readonly name = "Custom Backend";
        public readonly priority = 50;

        public async getPassword(): Promise<string | null> {
          return null;
        }
        public async setPassword(): Promise<void> {}
        public async deletePassword(): Promise<void> {}
        public async getCredential(): Promise<Credential | null> {
          return null;
        }
        public withProperties(): SecretStorageBackend {
          return this;
        }
        public async diagnose(): Promise<Record<string, unknown>> {
          return { id: this.id, name: this.name, priority: this.priority };
        }
      }

      const customFactory = CustomBackend as unknown as {
        new (...args: unknown[]): SecretStorageBackend;
        prototype: SecretStorageBackend;
      };

      mod.registerBackend(customFactory);
      mod.__resetRegistryForTests();

      const allBackends = await mod.getAllBackends();
      const customBackend = allBackends.find((b) => b.id === "custom");
      expect(customBackend).toBeDefined();
      expect(customBackend?.name).toBe("Custom Backend");
    });
  });

  describe("getKeyring", () => {
    it("initializes backend on first call", async () => {
      mockAllNativeBackendsUnavailable();
      process.env.TS_KEYRING_ALLOW_INSECURE_FALLBACKS = "1";

      const backend = await mod.getKeyring();
      expect(backend).toBeDefined();
      expect(backend.id).toBeDefined();
    });

    it("returns the same backend on subsequent calls", async () => {
      mockAllNativeBackendsUnavailable();
      process.env.TS_KEYRING_ALLOW_INSECURE_FALLBACKS = "1";

      const backend1 = await mod.getKeyring();
      const backend2 = await mod.getKeyring();
      expect(backend1).toBe(backend2);
    });

    it("throws when only insecure fallback backends are available", async () => {
      mockAllNativeBackendsUnavailable();

      await expect(mod.getKeyring()).rejects.toBeInstanceOf(errors.InitError);
    });
  });

  describe("setKeyring", () => {
    it("sets the active backend", async () => {
      const nullBackend = new backends.NullBackend();
      mod.setKeyring(nullBackend);

      const backend = await mod.getKeyring();
      expect(backend).toBe(nullBackend);
      expect(backend.id).toBe("null");
    });

    it("overrides the default backend selection", async () => {
      const fileBackend = new backends.FileSystemBackend();
      mod.setKeyring(fileBackend);

      const backend = await mod.getKeyring();
      expect(backend.id).toBe("file");
    });
  });
});
