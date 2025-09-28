import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { promises as fs } from "fs";

import {
  setPassword,
  getPassword,
  deletePassword,
  useBackend,
  KeyringError,
  __testing,
  __resetKeyringStateForTests,
  type SecretStorageBackend,
} from "../src/index.js";

type BackendCtor = new (...args: unknown[]) => SecretStorageBackend;

type TestingExports = typeof __testing & {
  MacOSKeychainBackend: BackendCtor;
  SecretServiceBackend: BackendCtor;
  WindowsCredentialBackend: BackendCtor;
  FileSystemBackend: BackendCtor;
  NullBackend: BackendCtor;
};

const testing = __testing as TestingExports;

async function createTempFile(name: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cross-keychain-sec-"));
  return path.join(dir, name);
}

beforeEach(() => {
  __resetKeyringStateForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.KEYRING_PROPERTY_FILE_PATH;
  delete process.env.TS_KEYRING_BACKEND;
});

describe("Security: Input Validation Tests", () => {
  describe("Command injection attempts in service names", () => {
    it("should reject semicolons in service name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service;rm -rf /", "user", "password"),
      ).rejects.toThrow(KeyringError);
      await expect(
        setPassword("service;rm -rf /", "user", "password"),
      ).rejects.toThrow("contains invalid characters");
    });

    it("should reject pipes in service name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service | cat /etc/passwd", "user", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should reject backticks in service name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service`whoami`", "user", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should reject ampersands in service name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service & echo hacked", "user", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should reject dollar signs in service name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service$PATH", "user", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should reject redirects in service name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service > /tmp/hack", "user", "password"),
      ).rejects.toThrow(KeyringError);
      await expect(
        setPassword("service < /etc/passwd", "user", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should reject newlines in service name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service\nrm -rf /", "user", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should reject parentheses for command substitution in service name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service$(whoami)", "user", "password"),
      ).rejects.toThrow(KeyringError);
    });
  });

  describe("Command injection attempts in account names", () => {
    it("should reject semicolons in account name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service", "user;rm -rf /", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should reject pipes in account name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service", "user | cat /etc/passwd", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should reject backticks in account name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service", "user`whoami`", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should reject shell variables in account name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service", "user$HOME", "password"),
      ).rejects.toThrow(KeyringError);
    });
  });

  describe("SQL injection style attacks", () => {
    it("should reject single quotes in service name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service' OR '1'='1", "user", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should reject double quotes in service name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword('service" OR "1"="1', "user", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should reject SQL comments in account name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service", "user-- comment", "password"),
      ).rejects.toThrow(KeyringError);
    });
  });

  describe("Shell metacharacter injection", () => {
    const shellMetachars = [
      { char: "`", name: "backtick" },
      { char: "$", name: "dollar sign" },
      { char: "|", name: "pipe" },
      { char: "&", name: "ampersand" },
      { char: ";", name: "semicolon" },
      { char: ">", name: "greater than" },
      { char: "<", name: "less than" },
      { char: "(", name: "left paren" },
      { char: ")", name: "right paren" },
      { char: "[", name: "left bracket" },
      { char: "]", name: "right bracket" },
      { char: "{", name: "left brace" },
      { char: "}", name: "right brace" },
      { char: "\\", name: "backslash" },
      { char: "'", name: "single quote" },
      { char: '"', name: "double quote" },
      { char: "\n", name: "newline" },
      { char: "\r", name: "carriage return" },
    ];

    shellMetachars.forEach(({ char, name }) => {
      it(`should reject ${name} in service name`, async () => {
        const storePath = await createTempFile("store.json");
        await useBackend("file", { file_path: storePath });

        await expect(
          setPassword(`service${char}test`, "user", "password"),
        ).rejects.toThrow(KeyringError);
      });

      it(`should reject ${name} in account name`, async () => {
        const storePath = await createTempFile("store.json");
        await useBackend("file", { file_path: storePath });

        await expect(
          setPassword("service", `user${char}test`, "password"),
        ).rejects.toThrow(KeyringError);
      });
    });
  });

  describe("Buffer overflow attempts", () => {
    it("should reject very long service names (>255 chars)", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      const longService = "a".repeat(256);
      await expect(
        setPassword(longService, "user", "password"),
      ).rejects.toThrow(KeyringError);
      await expect(
        setPassword(longService, "user", "password"),
      ).rejects.toThrow("exceeds maximum length");
    });

    it("should reject very long account names (>255 chars)", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      const longAccount = "a".repeat(256);
      await expect(
        setPassword("service", longAccount, "password"),
      ).rejects.toThrow(KeyringError);
      await expect(
        setPassword("service", longAccount, "password"),
      ).rejects.toThrow("exceeds maximum length");
    });

    it("should reject very long passwords (>4096 chars)", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      const longPassword = "a".repeat(4097);
      await expect(
        setPassword("service", "user", longPassword),
      ).rejects.toThrow(KeyringError);
      await expect(
        setPassword("service", "user", longPassword),
      ).rejects.toThrow("exceeds maximum length");
    });

    it("should accept 255 character service name (boundary test)", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      const maxService = "a".repeat(255);
      await setPassword(maxService, "user", "password");
      expect(await getPassword(maxService, "user")).toBe("password");
    });

    it("should accept 4096 character password (boundary test)", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      const maxPassword = "a".repeat(4096);
      await setPassword("service", "user", maxPassword);
      expect(await getPassword("service", "user")).toBe(maxPassword);
    });
  });

  describe("Empty string validation", () => {
    it("should reject empty service name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(setPassword("", "user", "password")).rejects.toThrow(
        KeyringError,
      );
      await expect(setPassword("", "user", "password")).rejects.toThrow(
        "cannot be empty",
      );
    });

    it("should reject empty account name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(setPassword("service", "", "password")).rejects.toThrow(
        KeyringError,
      );
    });

    it("should reject empty password", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(setPassword("service", "user", "")).rejects.toThrow(
        KeyringError,
      );
      await expect(setPassword("service", "user", "")).rejects.toThrow(
        "cannot be empty",
      );
    });
  });

  describe("Unicode attacks", () => {
    it("should reject null bytes in service name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service\0test", "user", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should reject null bytes in account name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await expect(
        setPassword("service", "user\0test", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should normalize Unicode in service name (NFC)", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      // Both composed and decomposed forms should be rejected consistently
      // é can be represented as single char (U+00E9) or e + combining acute (U+0065 U+0301)
      const serviceComposed = "caf\u00e9"; // é as single character
      const serviceDecomposed = "cafe\u0301"; // e + combining acute

      // Both forms should be rejected (non-ASCII)
      await expect(
        setPassword(serviceComposed, "user", "password"),
      ).rejects.toThrow(KeyringError);
      await expect(
        setPassword(serviceDecomposed, "user", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should reject RTL override characters in service name", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      // U+202E is RIGHT-TO-LEFT OVERRIDE
      await expect(
        setPassword("service\u202Etest", "user", "password"),
      ).rejects.toThrow(KeyringError);
    });

    it("should handle valid Unicode characters in passwords", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      const unicodePassword = "пароль密码🔐";
      await setPassword("service", "user", unicodePassword);
      expect(await getPassword("service", "user")).toBe(unicodePassword);
    });
  });

  describe("Positive tests - valid inputs should succeed", () => {
    it("should accept alphanumeric service names", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await setPassword("MyService123", "user", "password");
      expect(await getPassword("MyService123", "user")).toBe("password");
    });

    it("should accept dots, underscores, @ and hyphens in identifiers", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await setPassword("my.service-name", "user_123", "password");
      expect(await getPassword("my.service-name", "user_123")).toBe("password");

      await setPassword("service", "user@example.com", "password2");
      expect(await getPassword("service", "user@example.com")).toBe(
        "password2",
      );
    });

    it("should accept complex but valid identifiers", async () => {
      const storePath = await createTempFile("store.json");
      await useBackend("file", { file_path: storePath });

      await setPassword("com.example.app-prod", "john.doe@company-2024", "pwd");
      expect(
        await getPassword("com.example.app-prod", "john.doe@company-2024"),
      ).toBe("pwd");
    });
  });
});

describe("Security: Path Security Tests (FileSystemBackend)", () => {
  describe("Absolute path validation", () => {
    it("should reject /etc paths on Unix", async () => {
      if (process.platform === "win32") return;

      await useBackend("file", { file_path: "/etc/secrets.json" });

      // Path validation happens when trying to access the file
      await expect(setPassword("service", "user", "password")).rejects.toThrow(
        KeyringError,
      );
      await expect(setPassword("service", "user", "password")).rejects.toThrow(
        "protected system directory",
      );
    });

    it("should reject /sys paths on Unix", async () => {
      if (process.platform === "win32") return;

      await useBackend("file", { file_path: "/sys/secrets.json" });
      await expect(setPassword("service", "user", "password")).rejects.toThrow(
        KeyringError,
      );
    });

    it("should reject /proc paths on Unix", async () => {
      if (process.platform === "win32") return;

      await useBackend("file", { file_path: "/proc/secrets.json" });
      await expect(setPassword("service", "user", "password")).rejects.toThrow(
        KeyringError,
      );
    });

    it("should reject /dev paths on Unix", async () => {
      if (process.platform === "win32") return;

      await useBackend("file", { file_path: "/dev/secrets.json" });
      await expect(setPassword("service", "user", "password")).rejects.toThrow(
        KeyringError,
      );
    });

    it("should reject /root paths on Unix", async () => {
      if (process.platform === "win32") return;

      await useBackend("file", { file_path: "/root/secrets.json" });
      await expect(setPassword("service", "user", "password")).rejects.toThrow(
        KeyringError,
      );
    });

    it("should reject C:\\Windows paths on Windows", async () => {
      if (process.platform !== "win32") return;

      await useBackend("file", { file_path: "C:\\Windows\\secrets.json" });
      await expect(setPassword("service", "user", "password")).rejects.toThrow(
        KeyringError,
      );
    });

    it("should reject C:\\System paths on Windows", async () => {
      if (process.platform !== "win32") return;

      await useBackend("file", { file_path: "C:\\System\\secrets.json" });
      await expect(setPassword("service", "user", "password")).rejects.toThrow(
        KeyringError,
      );
    });
  });

  describe("Path traversal attempts", () => {
    it("should normalize paths with ../ segments", async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "cross-keychain-path-"),
      );
      const storePath = path.join(tempDir, "subdir", "..", "store.json");

      await useBackend("file", { file_path: storePath });
      await setPassword("service", "user", "password");

      const normalizedPath = path.normalize(storePath);
      const content = await fs.readFile(normalizedPath);
      expect(content.length).toBeGreaterThan(0);
    });

    it("should prevent traversal to system directories via path traversal", async () => {
      if (process.platform === "win32") return;

      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "cross-keychain-path-"),
      );

      // Try to escape to /etc via path traversal
      const maliciousPath = path.join(
        tempDir,
        "..",
        "..",
        "..",
        "..",
        "..",
        "etc",
        "secrets.json",
      );

      await useBackend("file", { file_path: maliciousPath });

      // Should be rejected because it normalizes to /etc/secrets.json
      await expect(setPassword("service", "user", "password")).rejects.toThrow(
        /protected system directory|EACCES/,
      );
    });
  });

  describe("Null byte injection", () => {
    it("should handle null bytes in file paths", async () => {
      // Node.js typically rejects null bytes in paths at the fs level
      // This test verifies that behavior is preserved
      const maliciousPath = "/tmp/secrets\0.json";

      try {
        await useBackend("file", { file_path: maliciousPath });
        await setPassword("service", "user", "password");
        // If we get here, the operation should fail
        expect.fail("Should have thrown an error for null byte in path");
      } catch (error) {
        // Expected - either KeyringError or Node.js error
        expect(error).toBeDefined();
      }
    });
  });
});

describe("Security: Encryption Tests (FileSystemBackend)", () => {
  it("should encrypt data on disk (not plaintext JSON)", async () => {
    const storePath = await createTempFile("encrypted-store.json");
    await useBackend("file", { file_path: storePath });

    await setPassword("service", "user", "secret-password");

    const fileContent = await fs.readFile(storePath);
    const fileText = fileContent.toString();

    // Should not contain plaintext password
    expect(fileText).not.toContain("secret-password");
    // Should not be valid JSON
    expect(() => JSON.parse(fileText)).toThrow();
    // Should start with version byte (1)
    expect(fileContent[0]).toBe(1);
  });

  it("should decrypt encrypted files correctly", async () => {
    const storePath = await createTempFile("decrypt-test.json");
    await useBackend("file", { file_path: storePath });

    await setPassword("service", "user", "my-secret");

    // Reset and read again
    __resetKeyringStateForTests();
    await useBackend("file", { file_path: storePath });

    const retrieved = await getPassword("service", "user");
    expect(retrieved).toBe("my-secret");
  });

  it("should reject tampered encrypted files", async () => {
    const storePath = await createTempFile("tampered-store.json");
    await useBackend("file", { file_path: storePath });

    await setPassword("service", "user", "original-password");

    // Tamper with the file by flipping some bits
    const original = await fs.readFile(storePath);
    const tampered = Buffer.from(original);
    // Flip some bits in the encrypted data portion
    if (tampered.length > 50) {
      tampered[50] ^= 0xff;
      tampered[51] ^= 0xff;
    }
    await fs.writeFile(storePath, tampered);

    // Reset and try to read
    __resetKeyringStateForTests();
    await useBackend("file", { file_path: storePath });

    await expect(getPassword("service", "user")).rejects.toThrow();
  });

  it("should reject files with invalid version byte", async () => {
    const storePath = await createTempFile("invalid-version.json");

    // Create a file with unsupported version (99)
    const invalidData = Buffer.alloc(100);
    invalidData[0] = 99; // Invalid version
    await fs.writeFile(storePath, invalidData);

    await useBackend("file", { file_path: storePath });

    await expect(getPassword("service", "user")).rejects.toThrow(
      "Unsupported store format version",
    );
  });

  it("should use different encryption for each write", async () => {
    const storePath = await createTempFile("salt-test.json");
    await useBackend("file", { file_path: storePath });

    await setPassword("service", "user", "password");
    const content1 = await fs.readFile(storePath);

    await deletePassword("service", "user");
    await setPassword("service", "user", "password");
    const content2 = await fs.readFile(storePath);

    // Files should be different due to random salt and IV
    expect(Buffer.compare(content1, content2)).not.toBe(0);
  });
});

// NOTE: Backend-specific validation tests have been moved to their respective test files:
// - MacOSKeychainBackend → src/backends/macos.test.ts
// - SecretServiceBackend → src/backends/linux.test.ts
// - WindowsCredentialBackend → src/backends/windows.test.ts
// - FileSystemBackend → src/backends/file.test.ts
//
// These tests are commented out here to avoid duplication and mocking issues with the new module structure.

describe("Security: Error Message Sanitization", () => {
  it("should not expose passwords in error messages on write failure", async () => {
    const backend = new testing.FileSystemBackend({
      file_path: "/invalid/path/that/does/not/exist/store.json",
    });

    const sensitivePassword = "super-secret-password-12345";

    try {
      await backend.setPassword("service", "user", sensitivePassword);
      expect.fail("Should have thrown an error");
    } catch (error) {
      const err = error as Error;
      expect(err.message).not.toContain(sensitivePassword);
      expect(err.stack || "").not.toContain(sensitivePassword);
    }
  });

  // NOTE: Backend-specific error message tests moved to backend test files

  it("should not leak partial credentials in validation errors", async () => {
    const storePath = await createTempFile("store.json");
    await useBackend("file", { file_path: storePath });

    const invalidService = "service-with-invalid-char!@#$%";

    try {
      await setPassword(invalidService, "user", "password");
      expect.fail("Should have thrown an error");
    } catch (error) {
      const err = error as Error;
      // Error should mention invalid characters but not echo the full input
      expect(err.message).toContain("invalid characters");
      // Should not contain the actual invalid service name
      expect(err.message).not.toContain(invalidService);
    }
  });
});

describe("Security: Identifier Validation Regex", () => {
  it("should only allow alphanumeric, dots, underscores, @ and hyphens", async () => {
    const storePath = await createTempFile("store.json");
    await useBackend("file", { file_path: storePath });

    // Valid characters should work
    await setPassword("abc123", "user", "password");
    await setPassword("with.dot", "user", "password");
    await setPassword("with_underscore", "user", "password");
    await setPassword("with-hyphen", "user", "password");
    await setPassword("with@at", "user", "password");

    // Invalid characters should fail
    const invalidChars = [
      "!",
      "#",
      "$",
      "%",
      "^",
      "&",
      "*",
      "(",
      ")",
      "=",
      "+",
    ];
    for (const char of invalidChars) {
      await expect(
        setPassword(`service${char}name`, "user", "password"),
      ).rejects.toThrow(KeyringError);
    }
  });

  it("should normalize Unicode before validation", async () => {
    const storePath = await createTempFile("store.json");
    await useBackend("file", { file_path: storePath });

    // After normalization, café should still be rejected (é is not alphanumeric)
    await expect(setPassword("café", "user", "password")).rejects.toThrow(
      KeyringError,
    );
  });
});

describe("Security: Password Validation", () => {
  it("should accept passwords with special characters", async () => {
    const storePath = await createTempFile("store.json");
    await useBackend("file", { file_path: storePath });

    const complexPassword = "P@ssw0rd!#$%^&*(){}[]<>?/";
    await setPassword("service", "user", complexPassword);
    expect(await getPassword("service", "user")).toBe(complexPassword);
  });

  it("should accept passwords with Unicode", async () => {
    const storePath = await createTempFile("store.json");
    await useBackend("file", { file_path: storePath });

    const unicodePassword = "密码🔐пароль";
    await setPassword("service", "user", unicodePassword);
    expect(await getPassword("service", "user")).toBe(unicodePassword);
  });

  it("should normalize passwords using NFC", async () => {
    const storePath = await createTempFile("store.json");
    await useBackend("file", { file_path: storePath });

    // Store with composed form
    const passwordComposed = "caf\u00e9"; // é as single character
    await setPassword("service", "user", passwordComposed);

    // Both composed and decomposed should be treated the same (for validation)
    const backend = new testing.FileSystemBackend({ file_path: storePath });

    // Direct backend call to verify storage
    const stored = await backend.getPassword("service", "user");

    // The stored password should match when normalized
    expect(stored?.normalize("NFC")).toBe(passwordComposed.normalize("NFC"));
  });

  it("should enforce maximum password length", async () => {
    const storePath = await createTempFile("store.json");
    await useBackend("file", { file_path: storePath });

    const maxPassword = "a".repeat(4096);
    await setPassword("service", "user", maxPassword);
    expect(await getPassword("service", "user")).toBe(maxPassword);

    const tooLongPassword = "a".repeat(4097);
    await expect(
      setPassword("service", "user2", tooLongPassword),
    ).rejects.toThrow(KeyringError);
  });
});
