import { describe, it, expect, vi } from "vitest";
import path from "path";
import os from "os";
import { promises as fs } from "fs";
import { FileSystemBackend } from "./file.js";
import { KeyringError, PasswordDeleteError } from "../errors.js";

async function createTempFile(name: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "file-backend-test-"));
  return path.join(dir, name);
}

describe("FileSystemBackend", () => {
  describe("Basic Operations", () => {
    it("stores, retrieves, and deletes secrets", async () => {
      const storePath = await createTempFile("store.json");
      const backend = new FileSystemBackend({ file_path: storePath });

      await backend.setPassword("service-a", "user-a", "secret");
      expect(await backend.getPassword("service-a", "user-a")).toBe("secret");

      const credential = await backend.getCredential("service-a", "user-a");
      expect(credential).toEqual({ username: "user-a", password: "secret" });

      await backend.deletePassword("service-a", "user-a");
      expect(await backend.getPassword("service-a", "user-a")).toBeNull();
      await expect(
        backend.deletePassword("service-a", "user-a"),
      ).rejects.toBeInstanceOf(PasswordDeleteError);
    });

    it("honours KEYRING_PROPERTY_FILE_PATH override", async () => {
      const storePath = await createTempFile("env-store.json");
      const originalEnv = process.env.KEYRING_PROPERTY_FILE_PATH;

      try {
        process.env.KEYRING_PROPERTY_FILE_PATH = storePath;

        const backend = new FileSystemBackend();
        await backend.setPassword("env-service", "env-user", "env-secret");

        const password = await backend.getPassword("env-service", "env-user");
        expect(password).toBe("env-secret");
      } finally {
        if (originalEnv === undefined) {
          delete process.env.KEYRING_PROPERTY_FILE_PATH;
        } else {
          process.env.KEYRING_PROPERTY_FILE_PATH = originalEnv;
        }
      }
    });

    it("retains other accounts when deleting passwords", async () => {
      const file = await createTempFile("store.json");
      const backend = new FileSystemBackend({ file_path: file });

      await backend.setPassword("svc", "alice", "secret-a");
      await backend.setPassword("svc", "bob", "secret-b");

      await backend.deletePassword("svc", "alice");

      const bobPassword = await backend.getPassword("svc", "bob");
      expect(bobPassword).toBe("secret-b");
      const alicePassword = await backend.getPassword("svc", "alice");
      expect(alicePassword).toBeNull();
    });

    it("returns null for non-existent passwords", async () => {
      const storePath = await createTempFile("empty-store.json");
      const backend = new FileSystemBackend({ file_path: storePath });

      const password = await backend.getPassword("nonexistent", "user");
      expect(password).toBeNull();
    });

    it("handles multiple services", async () => {
      const storePath = await createTempFile("multi-service.json");
      const backend = new FileSystemBackend({ file_path: storePath });

      await backend.setPassword("service1", "user1", "pass1");
      await backend.setPassword("service2", "user2", "pass2");

      expect(await backend.getPassword("service1", "user1")).toBe("pass1");
      expect(await backend.getPassword("service2", "user2")).toBe("pass2");
    });

    it("updates existing passwords", async () => {
      const storePath = await createTempFile("update-store.json");
      const backend = new FileSystemBackend({ file_path: storePath });

      await backend.setPassword("service", "user", "old-password");
      await backend.setPassword("service", "user", "new-password");

      expect(await backend.getPassword("service", "user")).toBe("new-password");
    });
  });

  describe("Error Handling", () => {
    it("propagates invalid secrets file errors", async () => {
      const file = await createTempFile("invalid.json");
      await fs.writeFile(file, "{ not valid", "utf8");
      const backend = new FileSystemBackend({ file_path: file });
      await expect(backend.getPassword("svc", "user")).rejects.toThrow();
    });

    it("rethrows unexpected file read errors", async () => {
      const backend = new FileSystemBackend({
        file_path: "/tmp/missing.json",
      });
      const error = new Error("unreadable");
      const readSpy = vi.spyOn(fs, "readFile").mockRejectedValue(error);
      try {
        await expect(backend.getPassword("svc", "user")).rejects.toBe(error);
      } finally {
        readSpy.mockRestore();
      }
    });

    it("throws PasswordDeleteError when deleting non-existent password", async () => {
      const storePath = await createTempFile("delete-error.json");
      const backend = new FileSystemBackend({ file_path: storePath });

      await expect(
        backend.deletePassword("service", "user"),
      ).rejects.toBeInstanceOf(PasswordDeleteError);
    });
  });

  describe("Encryption", () => {
    it("encrypts data on disk (not plaintext JSON)", async () => {
      const storePath = await createTempFile("encrypted-store.json");
      const backend = new FileSystemBackend({ file_path: storePath });

      await backend.setPassword("service", "user", "secret-password");

      const fileContent = await fs.readFile(storePath);
      const fileText = fileContent.toString();

      expect(fileText).not.toContain("secret-password");
      expect(() => JSON.parse(fileText)).toThrow();
      expect(fileContent[0]).toBe(1);
    });

    it("decrypts encrypted files correctly", async () => {
      const storePath = await createTempFile("decrypt-test.json");
      const backend1 = new FileSystemBackend({ file_path: storePath });

      await backend1.setPassword("service", "user", "my-secret");

      const backend2 = new FileSystemBackend({ file_path: storePath });
      const retrieved = await backend2.getPassword("service", "user");
      expect(retrieved).toBe("my-secret");
    });

    it("rejects tampered encrypted files", async () => {
      const storePath = await createTempFile("tampered-store.json");
      const backend = new FileSystemBackend({ file_path: storePath });

      await backend.setPassword("service", "user", "original-password");

      const original = await fs.readFile(storePath);
      const tampered = Buffer.from(original);
      if (tampered.length > 50) {
        tampered[50] ^= 0xff;
        tampered[51] ^= 0xff;
      }
      await fs.writeFile(storePath, tampered);

      const backend2 = new FileSystemBackend({ file_path: storePath });
      await expect(backend2.getPassword("service", "user")).rejects.toThrow();
    });

    it("rejects files with invalid version byte", async () => {
      const storePath = await createTempFile("invalid-version.json");

      const invalidData = Buffer.alloc(100);
      invalidData[0] = 99;
      await fs.writeFile(storePath, invalidData);

      const backend = new FileSystemBackend({ file_path: storePath });

      await expect(backend.getPassword("service", "user")).rejects.toThrow(
        "Unsupported store format version",
      );
    });

    it("uses different encryption for each write", async () => {
      const storePath = await createTempFile("salt-test.json");
      const backend = new FileSystemBackend({ file_path: storePath });

      await backend.setPassword("service", "user", "password");
      const content1 = await fs.readFile(storePath);

      await backend.deletePassword("service", "user");
      await backend.setPassword("service", "user", "password");
      const content2 = await fs.readFile(storePath);

      expect(Buffer.compare(content1, content2)).not.toBe(0);
    });

    it("validates version byte is 1", async () => {
      const storePath = await createTempFile("version-check.json");
      const backend = new FileSystemBackend({ file_path: storePath });

      await backend.setPassword("service", "user", "password");

      const content = await fs.readFile(storePath);
      expect(content[0]).toBe(1);
    });
  });

  describe("Path Security", () => {
    describe("Absolute path validation", () => {
      it("rejects /etc paths on Unix", async () => {
        if (process.platform === "win32") return;

        const backend = new FileSystemBackend({
          file_path: "/etc/secrets.json",
        });

        await expect(
          backend.setPassword("service", "user", "password"),
        ).rejects.toThrow(KeyringError);
        await expect(
          backend.setPassword("service", "user", "password"),
        ).rejects.toThrow("protected system directory");
      });

      it("rejects /sys paths on Unix", async () => {
        if (process.platform === "win32") return;

        const backend = new FileSystemBackend({
          file_path: "/sys/secrets.json",
        });
        await expect(
          backend.setPassword("service", "user", "password"),
        ).rejects.toThrow(KeyringError);
      });

      it("rejects /proc paths on Unix", async () => {
        if (process.platform === "win32") return;

        const backend = new FileSystemBackend({
          file_path: "/proc/secrets.json",
        });
        await expect(
          backend.setPassword("service", "user", "password"),
        ).rejects.toThrow(KeyringError);
      });

      it("rejects /dev paths on Unix", async () => {
        if (process.platform === "win32") return;

        const backend = new FileSystemBackend({
          file_path: "/dev/secrets.json",
        });
        await expect(
          backend.setPassword("service", "user", "password"),
        ).rejects.toThrow(KeyringError);
      });

      it("rejects /root paths on Unix", async () => {
        if (process.platform === "win32") return;

        const backend = new FileSystemBackend({
          file_path: "/root/secrets.json",
        });
        await expect(
          backend.setPassword("service", "user", "password"),
        ).rejects.toThrow(KeyringError);
      });

      it("rejects C:\\Windows paths on Windows", async () => {
        if (process.platform !== "win32") return;

        const backend = new FileSystemBackend({
          file_path: "C:\\Windows\\secrets.json",
        });
        await expect(
          backend.setPassword("service", "user", "password"),
        ).rejects.toThrow(KeyringError);
      });

      it("rejects C:\\System paths on Windows", async () => {
        if (process.platform !== "win32") return;

        const backend = new FileSystemBackend({
          file_path: "C:\\System\\secrets.json",
        });
        await expect(
          backend.setPassword("service", "user", "password"),
        ).rejects.toThrow(KeyringError);
      });
    });

    describe("Path traversal attempts", () => {
      it("normalizes paths with ../ segments", async () => {
        const tempDir = await fs.mkdtemp(
          path.join(os.tmpdir(), "file-backend-path-"),
        );
        const storePath = path.join(tempDir, "subdir", "..", "store.json");

        const backend = new FileSystemBackend({ file_path: storePath });
        await backend.setPassword("service", "user", "password");

        const normalizedPath = path.normalize(storePath);
        const content = await fs.readFile(normalizedPath);
        expect(content.length).toBeGreaterThan(0);
      });

      it("prevents traversal to system directories via path traversal", async () => {
        if (process.platform === "win32") return;

        const tempDir = await fs.mkdtemp(
          path.join(os.tmpdir(), "file-backend-path-"),
        );

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

        const backend = new FileSystemBackend({ file_path: maliciousPath });

        await expect(
          backend.setPassword("service", "user", "password"),
        ).rejects.toThrow(/protected system directory|EACCES/);
      });
    });

    describe("Null byte injection", () => {
      it("handles null bytes in file paths", async () => {
        const maliciousPath = "/tmp/secrets\0.json";

        try {
          const backend = new FileSystemBackend({ file_path: maliciousPath });
          await backend.setPassword("service", "user", "password");
          expect.fail("Should have thrown an error for null byte in path");
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });
  });

  describe("File Permissions", () => {
    it("sets file permissions to 0600", async () => {
      if (process.platform === "win32") return;

      const storePath = await createTempFile("permissions-test.json");
      const backend = new FileSystemBackend({ file_path: storePath });

      await backend.setPassword("service", "user", "password");

      const stats = await fs.stat(storePath);
      const mode = stats.mode & 0o777;

      expect(mode).toBe(0o600);
    });

    it("maintains 0600 permissions on updates", async () => {
      if (process.platform === "win32") return;

      const storePath = await createTempFile("permissions-update.json");
      const backend = new FileSystemBackend({ file_path: storePath });

      await backend.setPassword("service", "user", "password1");
      await backend.setPassword("service", "user", "password2");

      const stats = await fs.stat(storePath);
      const mode = stats.mode & 0o777;

      expect(mode).toBe(0o600);
    });
  });

  describe("Master Key Management", () => {
    it("uses KEYRING_FILE_MASTER_KEY environment variable if provided", async () => {
      const storePath = await createTempFile("env-key-store.json");
      const originalEnv = process.env.KEYRING_FILE_MASTER_KEY;

      try {
        process.env.KEYRING_FILE_MASTER_KEY =
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

        const backend = new FileSystemBackend({ file_path: storePath });
        await backend.setPassword("service", "user", "secret");

        expect(await backend.getPassword("service", "user")).toBe("secret");
      } finally {
        if (originalEnv === undefined) {
          delete process.env.KEYRING_FILE_MASTER_KEY;
        } else {
          process.env.KEYRING_FILE_MASTER_KEY = originalEnv;
        }
      }
    });

    it("rejects invalid KEYRING_FILE_MASTER_KEY length", async () => {
      const storePath = await createTempFile("invalid-key-store.json");
      const originalEnv = process.env.KEYRING_FILE_MASTER_KEY;

      try {
        process.env.KEYRING_FILE_MASTER_KEY = "tooshort";

        const backend = new FileSystemBackend({ file_path: storePath });
        await expect(
          backend.setPassword("service", "user", "secret"),
        ).rejects.toThrow("KEYRING_FILE_MASTER_KEY must be 64 hex characters");
      } finally {
        if (originalEnv === undefined) {
          delete process.env.KEYRING_FILE_MASTER_KEY;
        } else {
          process.env.KEYRING_FILE_MASTER_KEY = originalEnv;
        }
      }
    });
  });

  describe("Backend Properties", () => {
    it("has correct backend properties", () => {
      const backend = new FileSystemBackend();
      expect(backend.id).toBe("file");
      expect(backend.name).toBe("Encrypted file storage (AES-256-GCM)");
      expect(backend.priority).toBe(0.5);
    });

    it("supports diagnose method", async () => {
      const backend = new FileSystemBackend();
      const diag = await backend.diagnose();
      expect(diag.id).toBe("file");
      expect(diag.name).toBe("Encrypted file storage (AES-256-GCM)");
      expect(diag.priority).toBe(0.5);
    });
  });

  describe("getCredential", () => {
    it("returns credential with username and password", async () => {
      const storePath = await createTempFile("credential-store.json");
      const backend = new FileSystemBackend({ file_path: storePath });

      await backend.setPassword("service", "username", "password");

      const credential = await backend.getCredential("service", "username");
      expect(credential).toEqual({
        username: "username",
        password: "password",
      });
    });

    it("returns null for non-existent credential", async () => {
      const storePath = await createTempFile("empty-credential.json");
      const backend = new FileSystemBackend({ file_path: storePath });

      const credential = await backend.getCredential("service", "username");
      expect(credential).toBeNull();
    });
  });
});
