import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MacOSKeychainBackend } from "./macos.js";
import { runtime } from "../runtime.js";
import {
  KeyringError,
  PasswordSetError,
  PasswordDeleteError,
} from "../errors.js";

const skipOnNonMacOS = process.platform === "darwin" ? describe : describe.skip;

skipOnNonMacOS("MacOSKeychainBackend", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPassword", () => {
    it("returns null when security reports missing password (code 44)", async () => {
      const spy = vi
        .spyOn(runtime, "runCommand")
        .mockResolvedValue({ code: 44, stdout: "", stderr: "" });

      const backend = new MacOSKeychainBackend();
      const result = await backend.getPassword("svc", "user");

      expect(result).toBeNull();
      expect(spy).toHaveBeenCalledWith(
        "security",
        ["find-generic-password", "-s", "svc", "-a", "user", "-w"],
        { timeoutMs: 10000 },
      );
    });

    it("throws when security command fails", async () => {
      vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 1,
        stdout: "",
        stderr: "boom",
      });

      const backend = new MacOSKeychainBackend();

      await expect(backend.getPassword("svc", "user")).rejects.toThrow(
        KeyringError,
      );
      await expect(backend.getPassword("svc", "user")).rejects.toThrow(
        /Keychain operation failed with code 1/,
      );
    });

    it("does not expose stderr in error messages", async () => {
      vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 1,
        stdout: "",
        stderr: "security: SecKeychainItemCopyContent sensitive-error-data",
      });

      const backend = new MacOSKeychainBackend();

      try {
        await backend.getPassword("service", "user");
        expect.fail("Should have thrown an error");
      } catch (error) {
        const err = error as Error;
        expect(err.message).not.toContain("SecKeychainItemCopyContent");
        expect(err.message).not.toContain("sensitive-error-data");
        expect(err.message).toContain("failed with code");
      }
    });

    it("validates service and account before running security command", async () => {
      const backend = new MacOSKeychainBackend();

      await expect(backend.getPassword("service;rm", "user")).rejects.toThrow(
        KeyringError,
      );

      await expect(
        backend.getPassword("service", "user`whoami`"),
      ).rejects.toThrow(KeyringError);
    });

    it("adds keychain path when keychain property is set", async () => {
      const spy = vi
        .spyOn(runtime, "runCommand")
        .mockResolvedValue({ code: 0, stdout: "password\n", stderr: "" });

      const backend = new MacOSKeychainBackend({
        keychain: "/tmp/custom.keychain",
      });

      await backend.getPassword("svc", "user");

      expect(spy).toHaveBeenCalled();
      const [, args] = spy.mock.calls[0];
      expect(args).toContain("-s");
      expect(args).toContain("svc");
      expect(args).toContain("-a");
      expect(args).toContain("user");
      expect(args[args.length - 1]).toBe("/tmp/custom.keychain");
    });

    it("returns trimmed password on success", async () => {
      vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 0,
        stdout: "mypassword\n",
        stderr: "",
      });

      const backend = new MacOSKeychainBackend();
      const result = await backend.getPassword("svc", "user");

      expect(result).toBe("mypassword");
    });
  });

  describe("setPassword", () => {
    it("throws when storing passwords fails", async () => {
      vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 2,
        stdout: "",
        stderr: "fail",
      });

      const backend = new MacOSKeychainBackend();

      await expect(
        backend.setPassword("svc", "user", "pw"),
      ).rejects.toBeInstanceOf(PasswordSetError);
      await expect(backend.setPassword("svc", "user", "pw")).rejects.toThrow(
        /Keychain operation failed with code 2/,
      );
    });

    it("validates service and account before running security command", async () => {
      const backend = new MacOSKeychainBackend();

      await expect(
        backend.setPassword("service;rm", "user", "password"),
      ).rejects.toThrow(KeyringError);

      await expect(
        backend.setPassword("service", "user`whoami`", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("adds keychain flag when keychain property is set", async () => {
      const spy = vi
        .spyOn(runtime, "runCommand")
        .mockResolvedValue({ code: 0, stdout: "", stderr: "" });

      const backend = new MacOSKeychainBackend({
        keychain: "/tmp/custom.keychain",
      });

      await backend.setPassword("svc", "user", "pw");

      expect(spy).toHaveBeenCalled();
      const [, args] = spy.mock.calls[0];
      expect(args).not.toContain("-k");
      expect(args[args.length - 1]).toBe("/tmp/custom.keychain");
    });

    it("calls security with correct arguments on success", async () => {
      const spy = vi
        .spyOn(runtime, "runCommand")
        .mockResolvedValue({ code: 0, stdout: "", stderr: "" });

      const backend = new MacOSKeychainBackend();
      await backend.setPassword("svc", "user", "pw");

      expect(spy).toHaveBeenCalledWith(
        "security",
        ["add-generic-password", "-s", "svc", "-a", "user", "-U", "-w", "pw"],
        { timeoutMs: 10000 },
      );
    });
  });

  describe("deletePassword", () => {
    it("throws when deleting passwords fails (code 2)", async () => {
      vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 2,
        stdout: "",
        stderr: "fail",
      });

      const backend = new MacOSKeychainBackend();

      await expect(
        backend.deletePassword("svc", "user"),
      ).rejects.toBeInstanceOf(PasswordDeleteError);
      await expect(backend.deletePassword("svc", "user")).rejects.toThrow(
        /Keychain operation failed with code 2/,
      );
    });

    it("throws when deleting non-existent passwords (code 44)", async () => {
      vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 44,
        stdout: "",
        stderr: "",
      });

      const backend = new MacOSKeychainBackend();

      await expect(
        backend.deletePassword("svc", "user"),
      ).rejects.toBeInstanceOf(PasswordDeleteError);
      await expect(backend.deletePassword("svc", "user")).rejects.toThrow(
        /Password not found/,
      );
    });

    it("validates service and account before running security command", async () => {
      const backend = new MacOSKeychainBackend();

      await expect(
        backend.deletePassword("service;rm", "user"),
      ).rejects.toThrow(KeyringError);

      await expect(
        backend.deletePassword("service", "user`whoami`"),
      ).rejects.toThrow(KeyringError);
    });

    it("calls security with correct arguments on success", async () => {
      const spy = vi
        .spyOn(runtime, "runCommand")
        .mockResolvedValue({ code: 0, stdout: "", stderr: "" });

      const backend = new MacOSKeychainBackend();
      await backend.deletePassword("svc", "user");

      expect(spy).toHaveBeenCalledWith(
        "security",
        ["delete-generic-password", "-s", "svc", "-a", "user"],
        { timeoutMs: 10000 },
      );
    });

    it("adds keychain path when keychain property is set", async () => {
      const spy = vi
        .spyOn(runtime, "runCommand")
        .mockResolvedValue({ code: 0, stdout: "", stderr: "" });

      const backend = new MacOSKeychainBackend({
        keychain: "/tmp/custom.keychain",
      });

      await backend.deletePassword("svc", "user");

      expect(spy).toHaveBeenCalled();
      const [, args] = spy.mock.calls[0];
      expect(args[args.length - 1]).toBe("/tmp/custom.keychain");
    });
  });

  describe("getCredential", () => {
    it("parses usernames from security output", async () => {
      const spy = vi.spyOn(runtime, "runCommand");

      spy.mockResolvedValueOnce({
        code: 0,
        stdout: '"acct"<blob>="user1"\n"acct"<blob>="user2"\n',
        stderr: "",
      });

      spy.mockResolvedValueOnce({
        code: 0,
        stdout: "secret\n",
        stderr: "",
      });

      const backend = new MacOSKeychainBackend();
      const credential = await backend.getCredential("svc");

      expect(credential).toEqual({ username: "user1", password: "secret" });

      const [, lookupArgs] = spy.mock.calls[0];
      expect(lookupArgs).toContain("find-generic-password");
      expect(lookupArgs).toContain("-s");
      expect(lookupArgs).toContain("svc");
      expect(lookupArgs).not.toContain("-w");
    });

    it("returns null when username lookup fails", async () => {
      vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 2,
        stdout: "",
        stderr: "fail",
      });

      const backend = new MacOSKeychainBackend();
      const credential = await backend.getCredential("svc");

      expect(credential).toBeNull();
    });

    it("returns null when no usernames found", async () => {
      vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 0,
        stdout: "",
        stderr: "",
      });

      const backend = new MacOSKeychainBackend();
      const credential = await backend.getCredential("svc");

      expect(credential).toBeNull();
    });
  });

  describe("diagnose", () => {
    it("reports keychain selection in diagnostics", async () => {
      const backend = new MacOSKeychainBackend({
        keychain: "/tmp/test.keychain",
      });

      const report = await backend.diagnose();

      expect(report.keychain).toBe("/tmp/test.keychain");
      expect(report.name).toBe("macOS Keychain (CLI)");
      expect(report.id).toBe("macos");
      expect(report.priority).toBe(5);
    });

    it("reports default keychain when not configured", async () => {
      const backend = new MacOSKeychainBackend();

      const report = await backend.diagnose();

      expect(report.keychain).toBe("default");
    });
  });

  describe("isSupported", () => {
    it("returns true when on macOS and security exists", async () => {
      vi.spyOn(runtime, "executableExists").mockResolvedValue(true);

      const isSupported = await MacOSKeychainBackend.isSupported();

      expect(isSupported).toBe(true);
    });

    it("returns false when security does not exist", async () => {
      vi.spyOn(runtime, "executableExists").mockResolvedValue(false);

      const isSupported = await MacOSKeychainBackend.isSupported();

      expect(isSupported).toBe(false);
    });
  });

  describe("backend properties", () => {
    it("has correct backend metadata", () => {
      const backend = new MacOSKeychainBackend();

      expect(backend.id).toBe("macos");
      expect(backend.name).toBe("macOS Keychain (CLI)");
      expect(backend.priority).toBe(5);
    });
  });
});
