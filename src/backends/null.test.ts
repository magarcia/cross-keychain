import { describe, it, expect } from "vitest";
import { NullBackend } from "./null.js";
import { PasswordDeleteError } from "../errors.js";

describe("NullBackend", () => {
  it("returns null for getPassword", async () => {
    const backend = new NullBackend();
    const result = await backend.getPassword("service", "account");
    expect(result).toBeNull();
  });

  it("does not throw when setPassword is called", async () => {
    const backend = new NullBackend();
    await expect(
      backend.setPassword("service", "account", "password"),
    ).resolves.toBeUndefined();
  });

  it("throws PasswordDeleteError when deletePassword is called", async () => {
    const backend = new NullBackend();
    await expect(backend.deletePassword("service", "account")).rejects.toThrow(
      PasswordDeleteError,
    );
    await expect(backend.deletePassword("service", "account")).rejects.toThrow(
      "Null backend does not store passwords",
    );
  });

  it("returns null for getCredential with account", async () => {
    const backend = new NullBackend();
    const result = await backend.getCredential("service", "account");
    expect(result).toBeNull();
  });

  it("returns null for getCredential without account", async () => {
    const backend = new NullBackend();
    const result = await backend.getCredential("service");
    expect(result).toBeNull();
  });

  it("returns correct backend info from diagnose", async () => {
    const backend = new NullBackend();
    const info = await backend.diagnose();

    expect(info).toEqual({
      id: "null",
      name: "Null keyring",
      priority: -1,
    });
  });

  it("has priority of -1", () => {
    const backend = new NullBackend();
    expect(backend.priority).toBe(-1);
  });

  it("has correct id", () => {
    const backend = new NullBackend();
    expect(backend.id).toBe("null");
  });

  it("has correct name", () => {
    const backend = new NullBackend();
    expect(backend.name).toBe("Null keyring");
  });
});
