import { describe, it, expect, beforeEach, vi } from "vitest";

// Skip all tests on non-Linux platforms
const describeLinux = process.platform === "linux" ? describe : describe.skip;

describeLinux("NativeLinuxBackend", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("isSupported", () => {
    it("returns true when native module is available", async () => {
      // Mock successful module load
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          getPassword() {
            return "test";
          }
          setPassword(_password: string) {}
          deletePassword() {}
        },
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const result = await NativeLinuxBackend.isSupported();
      expect(result).toBe(true);
    });

    it("returns false when native module is unavailable", async () => {
      // Mock failed module load
      vi.doMock("@napi-rs/keyring", () => {
        throw new Error("Module not found");
      });

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const result = await NativeLinuxBackend.isSupported();
      expect(result).toBe(false);
    });
  });

  describe("backend properties", () => {
    it("has correct id", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const backend = new NativeLinuxBackend();
      expect(backend.id).toBe("native-linux");
    });

    it("has correct name", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const backend = new NativeLinuxBackend();
      expect(backend.name).toBe("Native Freedesktop Secret Service");
    });

    it("has priority of 10 (higher than secret-tool backend)", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const { SecretServiceBackend } = await import("./linux.js");

      const backend = new NativeLinuxBackend();
      const toolBackend = new SecretServiceBackend();
      expect(backend.priority).toBe(10);
      expect(toolBackend.priority).toBe(4.8);
      expect(backend.priority).toBeGreaterThan(toolBackend.priority);
    });
  });

  describe("getPassword", () => {
    it("retrieves password when native module is available", async () => {
      const mockGetPassword = vi.fn().mockReturnValue("test-password");
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          getPassword = mockGetPassword;
        },
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Load module

      const backend = new NativeLinuxBackend();
      const result = await backend.getPassword("test-service", "test-account");

      expect(result).toBe("test-password");
      expect(mockGetPassword).toHaveBeenCalled();
    });

    it("returns null when password is not found", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          getPassword() {
            throw new Error("Password not found");
          }
        },
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Load module

      const backend = new NativeLinuxBackend();
      const result = await backend.getPassword("test-service", "test-account");

      expect(result).toBeNull();
    });

    it("returns null when password does not exist", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          getPassword() {
            throw new Error("No such password");
          }
        },
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Load module

      const backend = new NativeLinuxBackend();
      const result = await backend.getPassword("test-service", "test-account");

      expect(result).toBeNull();
    });

    it("throws KeyringError when native module unavailable", async () => {
      vi.doMock("@napi-rs/keyring", () => {
        throw new Error("Module not found");
      });

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Attempt to load module

      const backend = new NativeLinuxBackend();

      await expect(
        backend.getPassword("test-service", "test-account"),
      ).rejects.toThrow("Native keyring module not available");
    });

    it("throws KeyringError for other native backend errors", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          getPassword() {
            throw new Error("Secret service access denied");
          }
        },
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Load module

      const backend = new NativeLinuxBackend();

      await expect(
        backend.getPassword("test-service", "test-account"),
      ).rejects.toThrow(
        "Native secret service error: Secret service access denied",
      );
    });

    it("validates service identifier", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const backend = new NativeLinuxBackend();

      await expect(backend.getPassword("", "test-account")).rejects.toThrow(
        "service cannot be empty",
      );
    });

    it("validates account identifier", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const backend = new NativeLinuxBackend();

      await expect(backend.getPassword("test-service", "")).rejects.toThrow(
        "account cannot be empty",
      );
    });
  });

  describe("setPassword", () => {
    it("stores password when native module is available", async () => {
      const mockSetPassword = vi.fn();
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          setPassword = mockSetPassword;
        },
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Load module

      const backend = new NativeLinuxBackend();
      await backend.setPassword(
        "test-service",
        "test-account",
        "test-password",
      );

      expect(mockSetPassword).toHaveBeenCalledWith("test-password");
    });

    it("throws KeyringError when native module unavailable", async () => {
      vi.doMock("@napi-rs/keyring", () => {
        throw new Error("Module not found");
      });

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Attempt to load module

      const backend = new NativeLinuxBackend();

      await expect(
        backend.setPassword("test-service", "test-account", "test-password"),
      ).rejects.toThrow("Native keyring module not available");
    });

    it("throws PasswordSetError for native backend errors", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          setPassword() {
            throw new Error("Access denied");
          }
        },
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Load module

      const backend = new NativeLinuxBackend();

      await expect(
        backend.setPassword("test-service", "test-account", "test-password"),
      ).rejects.toThrow("Native secret service error: Access denied");
    });

    it("validates service identifier", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const backend = new NativeLinuxBackend();

      await expect(
        backend.setPassword("", "test-account", "test-password"),
      ).rejects.toThrow("service cannot be empty");
    });

    it("validates account identifier", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const backend = new NativeLinuxBackend();

      await expect(
        backend.setPassword("test-service", "", "test-password"),
      ).rejects.toThrow("account cannot be empty");
    });

    it("validates password is not empty", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const backend = new NativeLinuxBackend();

      await expect(
        backend.setPassword("test-service", "test-account", ""),
      ).rejects.toThrow("Password cannot be empty");
    });
  });

  describe("deletePassword", () => {
    it("deletes password when it exists", async () => {
      const mockGetPassword = vi.fn().mockReturnValue("existing-password");
      const mockDeletePassword = vi.fn();

      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          getPassword = mockGetPassword;
          deletePassword = mockDeletePassword;
        },
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Load module

      const backend = new NativeLinuxBackend();
      await backend.deletePassword("test-service", "test-account");

      expect(mockGetPassword).toHaveBeenCalled();
      expect(mockDeletePassword).toHaveBeenCalled();
    });

    it("throws PasswordDeleteError when password not found", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          getPassword() {
            throw new Error("Password not found");
          }
        },
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Load module

      const backend = new NativeLinuxBackend();

      await expect(
        backend.deletePassword("test-service", "test-account"),
      ).rejects.toThrow("Password not found");
    });

    it("throws KeyringError when native module unavailable", async () => {
      vi.doMock("@napi-rs/keyring", () => {
        throw new Error("Module not found");
      });

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Attempt to load module

      const backend = new NativeLinuxBackend();

      await expect(
        backend.deletePassword("test-service", "test-account"),
      ).rejects.toThrow("Native keyring module not available");
    });

    it("throws PasswordDeleteError for native backend errors", async () => {
      const mockGetPassword = vi.fn().mockReturnValue("existing-password");

      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          getPassword = mockGetPassword;
          deletePassword() {
            throw new Error("Access denied");
          }
        },
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Load module

      const backend = new NativeLinuxBackend();

      await expect(
        backend.deletePassword("test-service", "test-account"),
      ).rejects.toThrow("Native secret service error: Access denied");
    });

    it("validates service identifier", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const backend = new NativeLinuxBackend();

      await expect(backend.deletePassword("", "test-account")).rejects.toThrow(
        "service cannot be empty",
      );
    });

    it("validates account identifier", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const backend = new NativeLinuxBackend();

      await expect(backend.deletePassword("test-service", "")).rejects.toThrow(
        "account cannot be empty",
      );
    });
  });

  describe("diagnose", () => {
    it("reports implementation type and fallback availability", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const { SecretServiceBackend } = await import("./linux.js");

      // Mock the SecretServiceBackend.isSupported
      vi.spyOn(SecretServiceBackend, "isSupported").mockResolvedValue(true);

      const backend = new NativeLinuxBackend();
      const info = await backend.diagnose();

      expect(info).toMatchObject({
        id: "native-linux",
        name: "Native Freedesktop Secret Service",
        priority: 10,
        implementation: "Native DBus bindings",
        fallbackAvailable: true,
      });
    });

    it("reports when fallback is not available", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const { SecretServiceBackend } = await import("./linux.js");

      // Mock the SecretServiceBackend.isSupported
      vi.spyOn(SecretServiceBackend, "isSupported").mockResolvedValue(false);

      const backend = new NativeLinuxBackend();
      const info = await backend.diagnose();

      expect(info.fallbackAvailable).toBe(false);
    });
  });

  describe("lookupUsernames", () => {
    it("returns empty array (not supported by native backend)", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      const backend = new NativeLinuxBackend();
      const result = await backend["lookupUsernames"]("test-service");

      expect(result).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("handles non-Error thrown objects", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          getPassword() {
            throw "string error";
          }
        },
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Load module

      const backend = new NativeLinuxBackend();

      await expect(
        backend.getPassword("test-service", "test-account"),
      ).rejects.toThrow("Native secret service error: string error");
    });

    it("handles errors with 'not exist' message", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          getPassword() {
            throw new Error("Item does not exist");
          }
        },
      }));

      const { NativeLinuxBackend } = await import("./native-linux.js");
      await NativeLinuxBackend.isSupported(); // Load module

      const backend = new NativeLinuxBackend();
      const result = await backend.getPassword("test-service", "test-account");

      expect(result).toBeNull();
    });
  });
});
