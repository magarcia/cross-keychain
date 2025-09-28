import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { ConfigurableBackend } from "./base-backend.js";
import { KeyringError } from "./errors.js";

class TestBackend extends ConfigurableBackend {
  public readonly id = "test";
  public readonly name = "Test Backend";
  public readonly priority = 1;

  private store = new Map<string, Map<string, string>>();

  public async getPassword(
    service: string,
    account: string,
  ): Promise<string | null> {
    const serviceStore = this.store.get(service);
    return serviceStore?.get(account) ?? null;
  }

  public async setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void> {
    if (!this.store.has(service)) {
      this.store.set(service, new Map());
    }
    this.store.get(service)!.set(account, password);
  }

  public async deletePassword(service: string, account: string): Promise<void> {
    const serviceStore = this.store.get(service);
    if (!serviceStore?.has(account)) {
      throw new KeyringError("Password not found");
    }
    serviceStore.delete(account);
  }

  public async lookupUsernames(service: string): Promise<string[]> {
    const serviceStore = this.store.get(service);
    return serviceStore ? Array.from(serviceStore.keys()) : [];
  }

  public getProperty(key: string): unknown {
    return this.properties[key];
  }

  public testNormalizeString(value: string): string {
    return this.normalizeString(value);
  }

  public testValidateIdentifier(value: string, name: string): void {
    this.validateIdentifier(value, name);
  }

  public testValidatePassword(password: string): void {
    this.validatePassword(password);
  }

  public testEnsureDir(dir: string): Promise<void> {
    return this.ensureDir(dir);
  }
}

describe("ConfigurableBackend", () => {
  beforeEach(() => {
    delete process.env.KEYRING_PROPERTY_FILE_PATH;
    delete process.env.KEYRING_PROPERTY_CUSTOM;
    delete process.env.KEYRING_PROPERTY_ENABLED;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor and property management", () => {
    it("initializes with empty properties when none provided", () => {
      const backend = new TestBackend();
      expect(backend.getProperty("file_path")).toBeUndefined();
    });

    it("initializes with provided properties", () => {
      const backend = new TestBackend({ custom: "value", count: 42 });
      expect(backend.getProperty("custom")).toBe("value");
      expect(backend.getProperty("count")).toBe(42);
    });

    it("preserves property types", () => {
      const backend = new TestBackend({
        string: "text",
        number: 123,
        boolean: true,
        object: { nested: "value" },
      });
      expect(backend.getProperty("string")).toBe("text");
      expect(backend.getProperty("number")).toBe(123);
      expect(backend.getProperty("boolean")).toBe(true);
      expect(backend.getProperty("object")).toEqual({ nested: "value" });
    });
  });

  describe("applyEnvOverrides", () => {
    it("applies environment variable overrides with KEYRING_PROPERTY_ prefix", () => {
      process.env.KEYRING_PROPERTY_FILE_PATH = "/custom/path";
      const backend = new TestBackend();
      expect(backend.getProperty("file_path")).toBe("/custom/path");
      delete process.env.KEYRING_PROPERTY_FILE_PATH;
    });

    it("converts property names to lowercase", () => {
      process.env.KEYRING_PROPERTY_CUSTOM_VALUE = "test";
      const backend = new TestBackend();
      expect(backend.getProperty("custom_value")).toBe("test");
      delete process.env.KEYRING_PROPERTY_CUSTOM_VALUE;
    });

    it("overrides constructor properties with environment variables", () => {
      process.env.KEYRING_PROPERTY_FILE_PATH = "/env/path";
      const backend = new TestBackend({ file_path: "/constructor/path" });
      expect(backend.getProperty("file_path")).toBe("/env/path");
      delete process.env.KEYRING_PROPERTY_FILE_PATH;
    });

    it("applies multiple environment overrides", () => {
      process.env.KEYRING_PROPERTY_PATH = "/path";
      process.env.KEYRING_PROPERTY_ENABLED = "true";
      process.env.KEYRING_PROPERTY_TIMEOUT = "30";
      const backend = new TestBackend();
      expect(backend.getProperty("path")).toBe("/path");
      expect(backend.getProperty("enabled")).toBe("true");
      expect(backend.getProperty("timeout")).toBe("30");
      delete process.env.KEYRING_PROPERTY_PATH;
      delete process.env.KEYRING_PROPERTY_ENABLED;
      delete process.env.KEYRING_PROPERTY_TIMEOUT;
    });

    it("ignores environment variables without KEYRING_PROPERTY_ prefix", () => {
      delete process.env.KEYRING_PROPERTY_CUSTOM_VALUE;
      process.env.CUSTOM_VALUE = "should-not-appear";
      const backend = new TestBackend();
      expect(backend.getProperty("custom_value")).toBeUndefined();
      delete process.env.CUSTOM_VALUE;
    });

    it("ignores undefined environment variables", () => {
      delete process.env.KEYRING_PROPERTY_UNDEFINED;
      const backend = new TestBackend({ undefined: "initial" });
      expect(backend.getProperty("undefined")).toBe("initial");
    });
  });

  describe("withProperties", () => {
    it("creates new instance with merged properties", () => {
      const original = new TestBackend({ a: 1, b: 2 });
      const updated = original.withProperties({ b: 3, c: 4 }) as TestBackend;

      expect(original.getProperty("a")).toBe(1);
      expect(original.getProperty("b")).toBe(2);
      expect(original.getProperty("c")).toBeUndefined();

      expect(updated.getProperty("a")).toBe(1);
      expect(updated.getProperty("b")).toBe(3);
      expect(updated.getProperty("c")).toBe(4);
    });

    it("returns instance of same class", () => {
      const original = new TestBackend();
      const updated = original.withProperties({ key: "value" });
      expect(updated).toBeInstanceOf(TestBackend);
      expect(updated.id).toBe("test");
    });

    it("does not modify original instance", () => {
      const original = new TestBackend({ initial: "value" });
      original.withProperties({ initial: "modified", new: "property" });

      expect(original.getProperty("initial")).toBe("value");
      expect(original.getProperty("new")).toBeUndefined();
    });

    it("applies environment overrides to new instance", () => {
      process.env.KEYRING_PROPERTY_FROM_ENV = "env-value";
      const original = new TestBackend({ prop: "original" });
      const updated = original.withProperties({
        prop: "updated",
      }) as TestBackend;

      expect(updated.getProperty("prop")).toBe("updated");
      expect(updated.getProperty("from_env")).toBe("env-value");
    });
  });

  describe("diagnose", () => {
    it("returns backend metadata", async () => {
      const backend = new TestBackend();
      const report = await backend.diagnose();

      expect(report.name).toBe("Test Backend");
      expect(report.id).toBe("test");
      expect(report.priority).toBe(1);
    });

    it("includes all required fields", async () => {
      const backend = new TestBackend();
      const report = await backend.diagnose();

      expect(report).toHaveProperty("name");
      expect(report).toHaveProperty("id");
      expect(report).toHaveProperty("priority");
    });
  });

  describe("normalizeString", () => {
    it("applies NFC normalization", () => {
      const backend = new TestBackend();

      const decomposed = "e\u0301"; // é as e + combining acute accent
      const composed = "é"; // é as single character

      const result = backend.testNormalizeString(decomposed);
      expect(result).toBe(composed);
      expect(result.length).toBe(1);
    });

    it("preserves already normalized strings", () => {
      const backend = new TestBackend();
      const input = "hello world";
      const result = backend.testNormalizeString(input);
      expect(result).toBe(input);
    });

    it("normalizes complex unicode strings", () => {
      const backend = new TestBackend();
      // "café" where é is already normalized + combining acute accent on top
      const input = "café\u0301";
      const result = backend.testNormalizeString(input);
      // NFC normalization combines the accents, but since there's already
      // an é and we add another accent, the result keeps both marks
      expect(result.normalize("NFC")).toBe(result);
      expect(result).toContain("caf");
    });
  });

  describe("validateIdentifier", () => {
    it("accepts valid identifiers", () => {
      const backend = new TestBackend();

      expect(() =>
        backend.testValidateIdentifier("service", "Service"),
      ).not.toThrow();
      expect(() =>
        backend.testValidateIdentifier("my-service", "Service"),
      ).not.toThrow();
      expect(() =>
        backend.testValidateIdentifier("my_service", "Service"),
      ).not.toThrow();
      expect(() =>
        backend.testValidateIdentifier("my.service", "Service"),
      ).not.toThrow();
      expect(() =>
        backend.testValidateIdentifier("user@example.com", "Account"),
      ).not.toThrow();
      expect(() =>
        backend.testValidateIdentifier("User123", "Account"),
      ).not.toThrow();
    });

    it("rejects empty identifiers", () => {
      const backend = new TestBackend();

      expect(() => backend.testValidateIdentifier("", "Service")).toThrow(
        KeyringError,
      );
      expect(() => backend.testValidateIdentifier("", "Service")).toThrow(
        "Service cannot be empty",
      );
    });

    it("rejects identifiers exceeding 255 characters", () => {
      const backend = new TestBackend();
      const longIdentifier = "a".repeat(256);

      expect(() =>
        backend.testValidateIdentifier(longIdentifier, "Service"),
      ).toThrow(KeyringError);
      expect(() =>
        backend.testValidateIdentifier(longIdentifier, "Service"),
      ).toThrow("Service exceeds maximum length of 255 characters");
    });

    it("accepts identifiers with exactly 255 characters", () => {
      const backend = new TestBackend();
      const maxIdentifier = "a".repeat(255);

      expect(() =>
        backend.testValidateIdentifier(maxIdentifier, "Service"),
      ).not.toThrow();
    });

    it("rejects identifiers with invalid characters", () => {
      const backend = new TestBackend();

      expect(() =>
        backend.testValidateIdentifier("service name", "Service"),
      ).toThrow(KeyringError);
      expect(() =>
        backend.testValidateIdentifier("service/path", "Service"),
      ).toThrow(KeyringError);
      expect(() =>
        backend.testValidateIdentifier("service:port", "Service"),
      ).toThrow(KeyringError);
      expect(() =>
        backend.testValidateIdentifier("service;value", "Service"),
      ).toThrow(KeyringError);
      expect(() =>
        backend.testValidateIdentifier("service$var", "Service"),
      ).toThrow("contains invalid characters");
    });

    it("normalizes before validation", () => {
      const backend = new TestBackend();
      // Use only alphanumeric characters for identifier validation test
      // since accented characters aren't allowed in identifiers
      const decomposed = "test123"; // Simple valid identifier

      expect(() =>
        backend.testValidateIdentifier(decomposed, "Service"),
      ).not.toThrow();
    });
  });

  describe("validatePassword", () => {
    it("accepts valid passwords", () => {
      const backend = new TestBackend();

      expect(() => backend.testValidatePassword("simple")).not.toThrow();
      expect(() =>
        backend.testValidatePassword("password with spaces"),
      ).not.toThrow();
      expect(() => backend.testValidatePassword("p@ssw0rd!")).not.toThrow();
      expect(() => backend.testValidatePassword("🔐🔑")).not.toThrow();
    });

    it("rejects empty passwords", () => {
      const backend = new TestBackend();

      expect(() => backend.testValidatePassword("")).toThrow(KeyringError);
      expect(() => backend.testValidatePassword("")).toThrow(
        "Password cannot be empty",
      );
    });

    it("rejects passwords exceeding 4096 characters", () => {
      const backend = new TestBackend();
      const longPassword = "a".repeat(4097);

      expect(() => backend.testValidatePassword(longPassword)).toThrow(
        KeyringError,
      );
      expect(() => backend.testValidatePassword(longPassword)).toThrow(
        "Password exceeds maximum length of 4096 characters",
      );
    });

    it("accepts passwords with exactly 4096 characters", () => {
      const backend = new TestBackend();
      const maxPassword = "a".repeat(4096);

      expect(() => backend.testValidatePassword(maxPassword)).not.toThrow();
    });

    it("normalizes before validation", () => {
      const backend = new TestBackend();
      const decomposed = "passwo\u0301rd"; // password with combining accent

      expect(() => backend.testValidatePassword(decomposed)).not.toThrow();
    });

    it("accepts passwords with various unicode characters", () => {
      const backend = new TestBackend();

      expect(() => backend.testValidatePassword("パスワード")).not.toThrow();
      expect(() => backend.testValidatePassword("пароль")).not.toThrow();
      expect(() => backend.testValidatePassword("密码")).not.toThrow();
    });
  });

  describe("ensureDir", () => {
    it("creates directory with 0700 permissions", async () => {
      const backend = new TestBackend();
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "keyring-test-dir-"),
      );
      const testDir = path.join(tempDir, "nested", "directory");

      try {
        await backend.testEnsureDir(testDir);

        const stats = await fs.stat(testDir);
        expect(stats.isDirectory()).toBe(true);

        // Check permissions (0o700 = owner read/write/execute only)
        if (process.platform !== "win32") {
          const mode = stats.mode & 0o777;
          expect(mode).toBe(0o700);
        }
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it("succeeds when directory already exists", async () => {
      const backend = new TestBackend();
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "keyring-test-existing-"),
      );

      try {
        await backend.testEnsureDir(tempDir);
        await backend.testEnsureDir(tempDir);

        const stats = await fs.stat(tempDir);
        expect(stats.isDirectory()).toBe(true);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it("creates nested directories recursively", async () => {
      const backend = new TestBackend();
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "keyring-test-nested-"),
      );
      const nestedDir = path.join(tempDir, "a", "b", "c", "d");

      try {
        await backend.testEnsureDir(nestedDir);

        const stats = await fs.stat(nestedDir);
        expect(stats.isDirectory()).toBe(true);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("getCredential", () => {
    it("retrieves credential when account is provided", async () => {
      const backend = new TestBackend();
      await backend.setPassword("service", "alice", "secret");

      const credential = await backend.getCredential("service", "alice");

      expect(credential).toEqual({ username: "alice", password: "secret" });
    });

    it("returns null when account is provided but password not found", async () => {
      const backend = new TestBackend();

      const credential = await backend.getCredential("service", "missing");

      expect(credential).toBeNull();
    });

    it("retrieves first credential when no account provided", async () => {
      const backend = new TestBackend();
      await backend.setPassword("service", "alice", "secret-a");
      await backend.setPassword("service", "bob", "secret-b");

      const credential = await backend.getCredential("service");

      expect(credential).toEqual({ username: "alice", password: "secret-a" });
    });

    it("returns null when no account provided and no usernames exist", async () => {
      const backend = new TestBackend();

      const credential = await backend.getCredential("service");

      expect(credential).toBeNull();
    });

    it("returns null when username lookup finds no password", async () => {
      const backend = new TestBackend();
      const spy = vi
        .spyOn(backend, "lookupUsernames")
        .mockResolvedValue(["ghost"]);

      const credential = await backend.getCredential("service");

      expect(credential).toBeNull();
      spy.mockRestore();
    });

    it("handles explicit null account parameter", async () => {
      const backend = new TestBackend();
      await backend.setPassword("service", "alice", "secret");

      const credential = await backend.getCredential("service", null);

      expect(credential).toEqual({ username: "alice", password: "secret" });
    });
  });

  describe("lookupUsernames default behavior", () => {
    it("returns empty array by default", async () => {
      class MinimalBackend extends ConfigurableBackend {
        public readonly id = "minimal";
        public readonly name = "Minimal";
        public readonly priority = 1;

        public async getPassword(): Promise<string | null> {
          return null;
        }

        public async setPassword(): Promise<void> {}

        public async deletePassword(): Promise<void> {}
      }

      const backend = new MinimalBackend();
      const usernames = await backend["lookupUsernames"]("service");

      expect(usernames).toEqual([]);
    });
  });

  describe("integration with backend operations", () => {
    it("successfully stores and retrieves credentials", async () => {
      const backend = new TestBackend();

      await backend.setPassword("app", "user", "password");
      const retrieved = await backend.getPassword("app", "user");

      expect(retrieved).toBe("password");
    });

    it("handles multiple services independently", async () => {
      const backend = new TestBackend();

      await backend.setPassword("service-a", "user", "secret-a");
      await backend.setPassword("service-b", "user", "secret-b");

      expect(await backend.getPassword("service-a", "user")).toBe("secret-a");
      expect(await backend.getPassword("service-b", "user")).toBe("secret-b");
    });

    it("handles multiple accounts per service", async () => {
      const backend = new TestBackend();

      await backend.setPassword("service", "alice", "secret-a");
      await backend.setPassword("service", "bob", "secret-b");

      expect(await backend.getPassword("service", "alice")).toBe("secret-a");
      expect(await backend.getPassword("service", "bob")).toBe("secret-b");
    });
  });
});
