import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WindowsCredentialBackend } from "./windows.js";
import { runtime } from "../runtime.js";
import {
  KeyringError,
  PasswordSetError,
  PasswordDeleteError,
} from "../errors.js";

describe("WindowsCredentialBackend", () => {
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalPlatform) {
      Object.defineProperty(process, "platform", originalPlatform);
    }
  });

  describe("isSupported", () => {
    it("is not supported when PowerShell is unavailable", async () => {
      vi.spyOn(runtime, "runPowerShell").mockRejectedValue(new Error("no ps"));
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });

      const supported = await WindowsCredentialBackend.isSupported();

      expect(supported).toBe(false);
    });

    it("reports support when PowerShell is available", async () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 0,
        stdout: "ok",
        stderr: "",
      });

      const supported = await WindowsCredentialBackend.isSupported();

      expect(supported).toBe(true);
    });

    it("is not supported on non-Windows platforms", async () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "darwin",
      });

      const supported = await WindowsCredentialBackend.isSupported();

      expect(supported).toBe(false);
    });
  });

  describe("getPassword", () => {
    it("returns null when credential does not exist (exit code 2)", async () => {
      vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 2,
        stdout: "",
        stderr: "",
      });
      const backend = new WindowsCredentialBackend();

      const result = await backend.getPassword("svc", "user");

      expect(result).toBeNull();
    });

    it("throws when read fails", async () => {
      vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 5,
        stdout: "",
        stderr: "fail",
      });
      const backend = new WindowsCredentialBackend();

      await expect(backend.getPassword("svc", "user")).rejects.toThrow(
        KeyringError,
      );
    });

    it("returns credentials when PowerShell succeeds", async () => {
      vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 0,
        stdout: "secret\r\n",
        stderr: "",
      });
      const backend = new WindowsCredentialBackend();

      const password = await backend.getPassword("svc", "user");

      expect(password).toBe("secret");
    });

    it("trims trailing newlines from password", async () => {
      vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 0,
        stdout: "secret\n",
        stderr: "",
      });
      const backend = new WindowsCredentialBackend();

      const password = await backend.getPassword("svc", "user");

      expect(password).toBe("secret");
    });
  });

  describe("setPassword", () => {
    it("throws when setting password fails", async () => {
      vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 1,
        stdout: "",
        stderr: "bad",
      });
      const backend = new WindowsCredentialBackend();

      await expect(
        backend.setPassword("svc", "user", "pw"),
      ).rejects.toBeInstanceOf(PasswordSetError);
    });

    it("successfully sets password when PowerShell succeeds", async () => {
      vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 0,
        stdout: "",
        stderr: "",
      });
      const backend = new WindowsCredentialBackend();

      await expect(
        backend.setPassword("svc", "user", "pw"),
      ).resolves.toBeUndefined();
    });

    it("interprets persistence values correctly", async () => {
      const spy = vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 0,
        stdout: "",
        stderr: "",
      });
      const backend = new WindowsCredentialBackend({
        persist: "session",
      });

      await backend.setPassword("svc", "user", "pw");

      const script = spy.mock.calls[0][0];
      expect(script).toContain("$persist = 1");
    });
  });

  describe("deletePassword", () => {
    it("throws when delete reports missing credential (code 2, Win32 error 1168)", async () => {
      vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 2,
        stdout: "",
        stderr: "",
      });
      const backend = new WindowsCredentialBackend();

      await expect(
        backend.deletePassword("svc", "user"),
      ).rejects.toBeInstanceOf(PasswordDeleteError);
    });

    it("throws when delete fails for other reasons", async () => {
      vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 5,
        stdout: "",
        stderr: "boom",
      });
      const backend = new WindowsCredentialBackend();

      await expect(
        backend.deletePassword("svc", "user"),
      ).rejects.toBeInstanceOf(PasswordDeleteError);
    });

    it("successfully deletes password when PowerShell succeeds", async () => {
      vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 0,
        stdout: "",
        stderr: "",
      });
      const backend = new WindowsCredentialBackend();

      await expect(
        backend.deletePassword("svc", "user"),
      ).resolves.toBeUndefined();
    });
  });

  describe("diagnostics", () => {
    it("reports persistence level in diagnostics", async () => {
      const backend = new WindowsCredentialBackend({ persist: "local" });

      const report = await backend.diagnose();

      expect(report.persistence).toBe(2);
    });

    it("respects numeric persistence overrides (1, 2, 3)", async () => {
      const backend = new WindowsCredentialBackend({ persist: 3 });

      const report = await backend.diagnose();

      expect(report.persistence).toBe(3);
    });

    it("normalizes persistence strings (session, local, enterprise)", async () => {
      const sessionBackend = new WindowsCredentialBackend({
        persist: "session",
      });
      const localBackend = new WindowsCredentialBackend({ persist: "local" });
      const enterpriseBackend = new WindowsCredentialBackend({
        persist: "enterprise",
      });

      const sessionReport = await sessionBackend.diagnose();
      const localReport = await localBackend.diagnose();
      const enterpriseReport = await enterpriseBackend.diagnose();

      expect(sessionReport.persistence).toBe(1);
      expect(localReport.persistence).toBe(2);
      expect(enterpriseReport.persistence).toBe(3);
    });

    it("defaults to enterprise persistence when not specified", async () => {
      const backend = new WindowsCredentialBackend();

      const report = await backend.diagnose();

      expect(report.persistence).toBe(3);
    });
  });

  describe("security validation", () => {
    it("validates identifiers before building PowerShell script", async () => {
      const backend = new WindowsCredentialBackend();

      await expect(
        backend.setPassword("service;Write-Host", "user", "password"),
      ).rejects.toThrow(KeyringError);

      await expect(
        backend.setPassword("service", "user$env:PATH", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("does not expose stderr in error messages", async () => {
      const backend = new WindowsCredentialBackend();

      vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 1,
        stdout: "",
        stderr: "CredWrite failed: Access denied to credential manager vault",
      });

      try {
        await backend.setPassword("service", "user", "password");
        expect.fail("Should have thrown an error");
      } catch (error) {
        const err = error as Error;
        expect(err.message).not.toContain("Access denied");
        expect(err.message).not.toContain("vault");
        expect(err.message).toContain("failed with code");
      }
    });

    it("Base64 encodes all user inputs in PowerShell", async () => {
      const backend = new WindowsCredentialBackend();

      const runPowerShellSpy = vi
        .spyOn(runtime, "runPowerShell")
        .mockResolvedValue({
          code: 0,
          stdout: "",
          stderr: "",
        });

      await backend.setPassword("service", "user", "password");

      expect(runPowerShellSpy).toHaveBeenCalled();
      const script = runPowerShellSpy.mock.calls[0][0];

      expect(script).toContain("FromBase64String");
      expect(script).toContain("UTF8.GetString");

      expect(script).not.toMatch(/\$target\s*=\s*["']service/);
      expect(script).not.toMatch(/\$username\s*=\s*["']user/);
      expect(script).not.toMatch(/\$password\s*=\s*["']password["']/);
    });
  });

  describe("persistence configuration", () => {
    it("accepts session persistence", async () => {
      const spy = vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 0,
        stdout: "",
        stderr: "",
      });
      const backend = new WindowsCredentialBackend({ persist: "session" });

      await backend.setPassword("svc", "user", "pw");

      const script = spy.mock.calls[0][0];
      expect(script).toContain("$persist = 1");
    });

    it("accepts local persistence", async () => {
      const spy = vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 0,
        stdout: "",
        stderr: "",
      });
      const backend = new WindowsCredentialBackend({ persist: "local" });

      await backend.setPassword("svc", "user", "pw");

      const script = spy.mock.calls[0][0];
      expect(script).toContain("$persist = 2");
    });

    it("accepts enterprise persistence", async () => {
      const spy = vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 0,
        stdout: "",
        stderr: "",
      });
      const backend = new WindowsCredentialBackend({ persist: "enterprise" });

      await backend.setPassword("svc", "user", "pw");

      const script = spy.mock.calls[0][0];
      expect(script).toContain("$persist = 3");
    });

    it("accepts numeric persistence values", async () => {
      const spy = vi.spyOn(runtime, "runPowerShell").mockResolvedValue({
        code: 0,
        stdout: "",
        stderr: "",
      });
      const backend = new WindowsCredentialBackend({ persist: 2 });

      await backend.setPassword("svc", "user", "pw");

      const script = spy.mock.calls[0][0];
      expect(script).toContain("$persist = 2");
    });

    it("accepts alternative persistence string names", async () => {
      const localMachineBackend = new WindowsCredentialBackend({
        persist: "local_machine",
      });
      const localMachineReport = await localMachineBackend.diagnose();
      expect(localMachineReport.persistence).toBe(2);

      const credPersistSessionBackend = new WindowsCredentialBackend({
        persist: "cred_persist_session",
      });
      const credPersistSessionReport =
        await credPersistSessionBackend.diagnose();
      expect(credPersistSessionReport.persistence).toBe(1);
    });
  });

  describe("backend properties", () => {
    it("has correct backend id", () => {
      const backend = new WindowsCredentialBackend();
      expect(backend.id).toBe("windows");
    });

    it("has correct backend name", () => {
      const backend = new WindowsCredentialBackend();
      expect(backend.name).toBe("Windows Credential Manager");
    });

    it("has correct priority", () => {
      const backend = new WindowsCredentialBackend();
      expect(backend.priority).toBe(5);
    });
  });
});
