import { describe, it, beforeEach, expect } from "vitest";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  __resetKeyringStateForTests,
  useBackend,
  setPassword,
  getPassword,
  getCredential,
  deletePassword,
  diagnose,
  PasswordDeleteError,
  PasswordSetError,
  KeyringError,
  NoKeyringError,
  __testing,
} from "../src/index.js";

const execFileAsync = promisify(execFile);

function uniqueId(prefix: string): string {
  return `${prefix}-${process.pid}-${Date.now()}-${randomUUID()}`;
}

async function safeDelete(service: string, account: string): Promise<void> {
  try {
    await deletePassword(service, account);
  } catch (error) {
    if (!(error instanceof PasswordDeleteError)) {
      throw error;
    }
  }
}

describe.sequential("Keyring smoke tests", () => {
  beforeEach(() => {
    __resetKeyringStateForTests();
    delete process.env.TS_KEYRING_BACKEND;
    delete process.env.KEYRING_PROPERTY_FILE_PATH;
  });

  it("stores secrets via the file backend", async () => {
    const base = await fs.mkdtemp(
      path.join(os.tmpdir(), "cross-keychain-smoke-file-"),
    );
    const store = path.join(base, "secrets.json");
    const keyFile = path.join(base, "file.key");
    await useBackend("file", { file_path: store, key_file_path: keyFile });

    const service = uniqueId("svc");
    const account = uniqueId("user");
    const secret = uniqueId("secret");

    try {
      await safeDelete(service, account);
      await setPassword(service, account, secret);

      expect(await getPassword(service, account)).toBe(secret);
      const credential = await getCredential(service, account);
      expect(credential).toEqual({ username: account, password: secret });

      const info = await diagnose();
      expect(info.name).toBe("Encrypted file storage (AES-256-GCM)");
      expect(typeof info.dataRoot).toBe("string");
    } finally {
      await safeDelete(service, account);
    }
  }, 20_000);

  it.runIf(process.platform === "darwin")(
    "stores secrets via the macOS keychain backend",
    async () => {
      const macBackend = __testing.MacOSKeychainBackend;
      if (!macBackend.isSupported) {
        return;
      }
      const supported = await macBackend.isSupported();
      if (!supported) {
        return;
      }

      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "cross-keychain-smoke-macos-"),
      );
      const keychain = path.join(tempDir, "test.keychain-db");
      await execFileAsync("security", ["create-keychain", "-p", "", keychain]);
      await execFileAsync("security", ["set-keychain-settings", keychain]);
      await execFileAsync("security", ["unlock-keychain", "-p", "", keychain]);

      const service = uniqueId("svc");
      const account = uniqueId("user");
      const secret = uniqueId("secret");

      try {
        await useBackend("macos", { keychain });
        await safeDelete(service, account);
        await setPassword(service, account, secret);

        expect(await getPassword(service, account)).toBe(secret);
        const credential = await getCredential(service, account);
        expect(credential).toEqual({ username: account, password: secret });
      } finally {
        await safeDelete(service, account);
        await execFileAsync("security", ["delete-keychain", keychain]).catch(
          () => {},
        );
      }
    },
    30_000,
  );

  it.runIf(process.platform === "linux")(
    "stores secrets via the Secret Service backend",
    async () => {
      const secretBackend = __testing.SecretServiceBackend;
      if (!secretBackend.isSupported) {
        return;
      }
      const supported = await secretBackend.isSupported();
      if (!supported) {
        return;
      }

      try {
        await useBackend("secret-service");
      } catch (error) {
        if (error instanceof NoKeyringError) {
          return;
        }
        throw error;
      }

      const service = uniqueId("svc");
      const account = uniqueId("user");
      const secret = uniqueId("secret");

      let stored = false;
      try {
        await safeDelete(service, account);
        await setPassword(service, account, secret);
        stored = true;

        expect(await getPassword(service, account)).toBe(secret);
        const credential = await getCredential(service, account);
        expect(credential).toEqual({ username: account, password: secret });
      } catch (error) {
        if (
          error instanceof PasswordSetError ||
          error instanceof KeyringError
        ) {
          return;
        }
        throw error;
      } finally {
        if (stored) {
          await safeDelete(service, account);
        }
      }
    },
    30_000,
  );

  it.runIf(process.platform === "win32")(
    "stores secrets via the Windows credential backend",
    async () => {
      const windowsBackend = __testing.WindowsCredentialBackend;
      if (!windowsBackend.isSupported) {
        return;
      }
      const supported = await windowsBackend.isSupported();
      if (!supported) {
        return;
      }

      await useBackend("windows", { persist: "session" });

      const service = uniqueId("svc");
      const account = uniqueId("user");
      const secret = uniqueId("secret");

      try {
        await safeDelete(service, account);
        await setPassword(service, account, secret);

        expect(await getPassword(service, account)).toBe(secret);
        const credential = await getCredential(service, account);
        expect(credential).toEqual({ username: account, password: secret });
      } finally {
        await safeDelete(service, account);
      }
    },
    30_000,
  );
});
