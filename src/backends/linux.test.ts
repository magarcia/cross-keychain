import { describe, it, expect, vi, beforeEach } from "vitest";
import { SecretServiceBackend } from "./linux.js";
import { runtime } from "../runtime.js";
import {
  KeyringError,
  PasswordSetError,
  PasswordDeleteError,
} from "../errors.js";

describe("SecretServiceBackend", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPassword", () => {
    it("returns null when secret-tool reports no result", async () => {
      const spy = vi
        .spyOn(runtime, "runCommand")
        .mockResolvedValue({ code: 1, stdout: "", stderr: "" });
      const backend = new SecretServiceBackend();

      const result = await backend.getPassword("svc", "user");
      expect(result).toBeNull();
      expect(spy).toHaveBeenCalled();
    });

    it("retrieves passwords and trims newline", async () => {
      const spy = vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 0,
        stdout: "secret\n",
        stderr: "",
      });
      const backend = new SecretServiceBackend();
      const password = await backend.getPassword("svc", "user");
      expect(password).toBe("secret");
      spy.mockRestore();
    });

    it("includes collection flag when configured", async () => {
      const spy = vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 0,
        stdout: "secret\n",
        stderr: "",
      });
      const backend = new SecretServiceBackend({
        collection: "my-collection",
      });
      await backend.getPassword("svc", "user");
      const [, args] = spy.mock.calls[0];
      expect(args).toContain("--collection=my-collection");
      spy.mockRestore();
    });

    it("throws when secret-tool lookup fails", async () => {
      const spy = vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 3,
        stdout: "",
        stderr: "error",
      });
      const backend = new SecretServiceBackend();
      await expect(backend.getPassword("svc", "user")).rejects.toBeInstanceOf(
        KeyringError,
      );
      spy.mockRestore();
    });

    it("does not expose stderr in error messages", async () => {
      const backend = new SecretServiceBackend();

      const runCommandSpy = vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 3,
        stdout: "",
        stderr: "** (secret-tool:1234): CRITICAL **: sensitive dbus error",
      });

      try {
        await backend.getPassword("service", "user");
      } catch (error) {
        const err = error as Error;
        expect(err.message).not.toContain("CRITICAL");
        expect(err.message).not.toContain("dbus");
        expect(err.message).toContain("failed with code");
      }

      expect(runCommandSpy).toHaveBeenCalled();
    });
  });

  describe("setPassword", () => {
    it("throws when secret-tool store fails", async () => {
      const spy = vi
        .spyOn(runtime, "runCommand")
        .mockResolvedValue({ code: 1, stdout: "", stderr: "boom" });
      const backend = new SecretServiceBackend();

      await expect(backend.setPassword("svc", "user", "pw")).rejects.toThrow(
        PasswordSetError,
      );
      expect(spy).toHaveBeenCalled();
    });

    it("adds collection flag when storing passwords", async () => {
      const spy = vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 0,
        stdout: "",
        stderr: "",
      });
      const backend = new SecretServiceBackend({ collection: "store" });
      await backend.setPassword("svc", "user", "pw");
      const [, args] = spy.mock.calls[0];
      expect(args).toContain("--collection=store");
      spy.mockRestore();
    });

    it("escapes single quotes in labels", async () => {
      const backend = new SecretServiceBackend();

      const runCommandSpy = vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 0,
        stdout: "",
        stderr: "",
      });

      await backend.setPassword("service", "user", "password");

      expect(runCommandSpy).toHaveBeenCalled();
      const [, args] = runCommandSpy.mock.calls[0];
      const labelIndex = args.indexOf("--label");
      expect(labelIndex).toBeGreaterThan(-1);
      const label = args[labelIndex + 1];
      expect(label).toBeTruthy();
    });

    it("validates identifiers before calling secret-tool", async () => {
      const backend = new SecretServiceBackend();

      await expect(
        backend.setPassword("service|cat", "user", "password"),
      ).rejects.toThrow(KeyringError);

      await expect(
        backend.setPassword("service", "user;ls", "password"),
      ).rejects.toThrow(KeyringError);
    });
  });

  describe("deletePassword", () => {
    it("throws when delete reports missing password", async () => {
      const spy = vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 1,
        stdout: "",
        stderr: "",
      });
      const backend = new SecretServiceBackend();
      await expect(
        backend.deletePassword("svc", "user"),
      ).rejects.toBeInstanceOf(PasswordDeleteError);
      spy.mockRestore();
    });

    it("throws when delete fails unexpectedly", async () => {
      const spy = vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 3,
        stdout: "",
        stderr: "boom",
      });
      const backend = new SecretServiceBackend({ collection: "clear" });
      await expect(
        backend.deletePassword("svc", "user"),
      ).rejects.toBeInstanceOf(PasswordDeleteError);
      const [, args] = spy.mock.calls[0];
      expect(args).toContain("--collection=clear");
      spy.mockRestore();
    });
  });

  describe("getCredential", () => {
    it("extracts credentials via lookup", async () => {
      const spy = vi.spyOn(runtime, "runCommand");
      spy.mockResolvedValueOnce({
        code: 0,
        stdout: "username=user1\nother=value\nusername=user2\n",
        stderr: "",
      });
      spy.mockResolvedValueOnce({
        code: 0,
        stdout: "secret\n",
        stderr: "",
      });
      const backend = new SecretServiceBackend();
      const credential = await backend.getCredential("svc");
      expect(credential).toEqual({ username: "user1", password: "secret" });
      spy.mockRestore();
    });

    it("returns null when username lookup fails", async () => {
      const spy = vi.spyOn(runtime, "runCommand").mockResolvedValue({
        code: 2,
        stdout: "",
        stderr: "fail",
      });
      const backend = new SecretServiceBackend();
      const credential = await backend.getCredential("svc");
      expect(credential).toBeNull();
      spy.mockRestore();
    });

    it("includes collection flag when searching for usernames", async () => {
      const spy = vi.spyOn(runtime, "runCommand");
      spy.mockResolvedValueOnce({
        code: 0,
        stdout: "invalid\nusername=user\n",
        stderr: "",
      });
      spy.mockResolvedValueOnce({
        code: 0,
        stdout: "secret\n",
        stderr: "",
      });
      const backend = new SecretServiceBackend({
        collection: "custom",
      });
      const credential = await backend.getCredential("svc");
      const [, args] = spy.mock.calls[0];
      expect(args).toContain("--collection=custom");
      expect(credential).toEqual({ username: "user", password: "secret" });
      spy.mockRestore();
    });
  });
});
