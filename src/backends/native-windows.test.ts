import { describe, it, expect, beforeEach, vi } from "vitest";

// Skip all tests on non-Windows platforms
const describeWindows = process.platform === "win32" ? describe : describe.skip;

describeWindows("NativeWindowsBackend", () => {
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

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const result = await NativeWindowsBackend.isSupported();
      expect(result).toBe(true);
    });

    it("returns false when native module is unavailable", async () => {
      // Mock failed module load
      vi.doMock("@napi-rs/keyring", () => {
        throw new Error("Module not found");
      });

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const result = await NativeWindowsBackend.isSupported();
      expect(result).toBe(false);
    });
  });

  describe("backend properties", () => {
    it("has correct id", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const backend = new NativeWindowsBackend();
      expect(backend.id).toBe("native-windows");
    });

    it("has correct name", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const backend = new NativeWindowsBackend();
      expect(backend.name).toBe("Native Windows Credential Manager");
    });

    it("has priority of 10 (higher than PowerShell backend)", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const { WindowsCredentialBackend } = await import("./windows.js");

      const backend = new NativeWindowsBackend();
      const psBackend = new WindowsCredentialBackend();
      expect(backend.priority).toBe(10);
      expect(psBackend.priority).toBe(5);
      expect(backend.priority).toBeGreaterThan(psBackend.priority);
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

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Load module

      const backend = new NativeWindowsBackend();
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

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Load module

      const backend = new NativeWindowsBackend();
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

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Load module

      const backend = new NativeWindowsBackend();
      const result = await backend.getPassword("test-service", "test-account");

      expect(result).toBeNull();
    });

    it("throws KeyringError when native module unavailable", async () => {
      vi.doMock("@napi-rs/keyring", () => {
        throw new Error("Module not found");
      });

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Attempt to load module

      const backend = new NativeWindowsBackend();

      await expect(
        backend.getPassword("test-service", "test-account"),
      ).rejects.toThrow("Native keyring module not available");
    });

    it("throws KeyringError for other native backend errors", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          getPassword() {
            throw new Error("Credential manager access denied");
          }
        },
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Load module

      const backend = new NativeWindowsBackend();

      await expect(
        backend.getPassword("test-service", "test-account"),
      ).rejects.toThrow(
        "Native credential manager error: Credential manager access denied",
      );
    });

    it("validates service identifier", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const backend = new NativeWindowsBackend();

      await expect(backend.getPassword("", "test-account")).rejects.toThrow(
        "service cannot be empty",
      );
    });

    it("validates account identifier", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const backend = new NativeWindowsBackend();

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

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Load module

      const backend = new NativeWindowsBackend();
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

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Attempt to load module

      const backend = new NativeWindowsBackend();

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

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Load module

      const backend = new NativeWindowsBackend();

      await expect(
        backend.setPassword("test-service", "test-account", "test-password"),
      ).rejects.toThrow("Native credential manager error: Access denied");
    });

    it("validates service identifier", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const backend = new NativeWindowsBackend();

      await expect(
        backend.setPassword("", "test-account", "test-password"),
      ).rejects.toThrow("service cannot be empty");
    });

    it("validates account identifier", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const backend = new NativeWindowsBackend();

      await expect(
        backend.setPassword("test-service", "", "test-password"),
      ).rejects.toThrow("account cannot be empty");
    });

    it("validates password is not empty", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const backend = new NativeWindowsBackend();

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

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Load module

      const backend = new NativeWindowsBackend();
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

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Load module

      const backend = new NativeWindowsBackend();

      await expect(
        backend.deletePassword("test-service", "test-account"),
      ).rejects.toThrow("Password not found");
    });

    it("throws KeyringError when native module unavailable", async () => {
      vi.doMock("@napi-rs/keyring", () => {
        throw new Error("Module not found");
      });

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Attempt to load module

      const backend = new NativeWindowsBackend();

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

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Load module

      const backend = new NativeWindowsBackend();

      await expect(
        backend.deletePassword("test-service", "test-account"),
      ).rejects.toThrow("Native credential manager error: Access denied");
    });

    it("validates service identifier", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const backend = new NativeWindowsBackend();

      await expect(backend.deletePassword("", "test-account")).rejects.toThrow(
        "service cannot be empty",
      );
    });

    it("validates account identifier", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const backend = new NativeWindowsBackend();

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

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const { WindowsCredentialBackend } = await import("./windows.js");

      // Mock the WindowsCredentialBackend.isSupported
      vi.spyOn(WindowsCredentialBackend, "isSupported").mockResolvedValue(true);

      const backend = new NativeWindowsBackend();
      const info = await backend.diagnose();

      expect(info).toMatchObject({
        id: "native-windows",
        name: "Native Windows Credential Manager",
        priority: 10,
        implementation: "Native DPAPI bindings",
        fallbackAvailable: true,
      });
    });

    it("reports when fallback is not available", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const { WindowsCredentialBackend } = await import("./windows.js");

      // Mock the WindowsCredentialBackend.isSupported
      vi.spyOn(WindowsCredentialBackend, "isSupported").mockResolvedValue(
        false,
      );

      const backend = new NativeWindowsBackend();
      const info = await backend.diagnose();

      expect(info.fallbackAvailable).toBe(false);
    });
  });

  describe("lookupUsernames", () => {
    it("returns empty array (not supported by native backend)", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {},
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      const backend = new NativeWindowsBackend();
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

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Load module

      const backend = new NativeWindowsBackend();

      await expect(
        backend.getPassword("test-service", "test-account"),
      ).rejects.toThrow("Native credential manager error: string error");
    });

    it("handles errors with 'not exist' message", async () => {
      vi.doMock("@napi-rs/keyring", () => ({
        Entry: class MockEntry {
          getPassword() {
            throw new Error("Item does not exist");
          }
        },
      }));

      const { NativeWindowsBackend } = await import("./native-windows.js");
      await NativeWindowsBackend.isSupported(); // Load module

      const backend = new NativeWindowsBackend();
      const result = await backend.getPassword("test-service", "test-account");

      expect(result).toBeNull();
    });
  });
});
