import path from "path";
import { promises as fs } from "fs";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { KeyringError, PasswordDeleteError } from "../errors.js";
import { ConfigurableBackend } from "../base-backend.js";
import { getDataRoot, getConfigRoot } from "../config.js";

/**
 * A backend that stores secrets in an encrypted local file.
 * Uses AES-256-GCM for authenticated encryption with a randomly generated key.
 * The encryption key is stored in a separate file with 0600 permissions.
 * This backend serves as a fallback when native platform keychains are unavailable.
 */
export class FileSystemBackend extends ConfigurableBackend {
  public readonly id = "file";
  public readonly name = "Encrypted file storage (AES-256-GCM)";
  public readonly priority = 0.5;

  private get filePath(): string {
    const custom = this.properties["file_path"];
    if (typeof custom === "string" && custom.length > 0) {
      const normalized = path.normalize(custom);

      const dangerousPaths = [
        "/etc",
        "/sys",
        "/proc",
        "/dev",
        "/root",
        "C:\\Windows",
        "C:\\System",
      ];
      for (const dangerous of dangerousPaths) {
        if (normalized.toLowerCase().startsWith(dangerous.toLowerCase())) {
          throw new KeyringError(
            `File path cannot be in protected system directory: ${dangerous}`,
          );
        }
      }

      if (path.isAbsolute(normalized)) {
        const dataRoot = getDataRoot();
        if (!normalized.startsWith(dataRoot)) {
          console.warn(
            `Warning: Using file path outside data directory: ${normalized}`,
          );
        }
      }

      return normalized;
    }
    return path.join(getDataRoot(), "secrets.json");
  }

  private get keyFilePath(): string {
    const custom = this.properties["key_file_path"];
    if (typeof custom === "string" && custom.length > 0) {
      return path.normalize(custom);
    }
    return path.join(getConfigRoot(), "file.key");
  }

  private async getKeyMaterial(): Promise<Buffer> {
    const envKey = process.env.KEYRING_FILE_MASTER_KEY;
    if (envKey) {
      if (envKey.length !== 64) {
        throw new KeyringError(
          "KEYRING_FILE_MASTER_KEY must be 64 hex characters (32 bytes)",
        );
      }
      return Buffer.from(envKey, "hex");
    }

    const keyFile = this.keyFilePath;
    try {
      const key = await fs.readFile(keyFile);
      if (key.length !== 32) {
        throw new KeyringError("Key file must contain exactly 32 bytes");
      }
      return key;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const key = randomBytes(32);
        await this.ensureDir(path.dirname(keyFile));
        await fs.writeFile(keyFile, key, { mode: 0o600 });
        return key;
      }
      throw error;
    }
  }

  private async encryptStore(
    store: Record<string, Record<string, string>>,
  ): Promise<Buffer> {
    const plaintext = JSON.stringify(store);

    const key = await this.getKeyMaterial();
    const iv = randomBytes(12);

    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const version = Buffer.from([1]);
    return Buffer.concat([version, iv, authTag, encrypted]);
  }

  private async decryptStore(
    data: Buffer,
  ): Promise<Record<string, Record<string, string>>> {
    const version = data[0];

    if (version === 1) {
      const iv = data.subarray(1, 13);
      const authTag = data.subarray(13, 29);
      const encrypted = data.subarray(29);

      const key = await this.getKeyMaterial();

      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return JSON.parse(decrypted.toString("utf8"));
    }

    throw new KeyringError(`Unsupported store format version: ${version}`);
  }

  /**
   * Retrieves a password from the encrypted file store.
   *
   * @param service - The service identifier
   * @param account - The account identifier
   * @returns The stored password, or null if not found
   */
  public async getPassword(
    service: string,
    account: string,
  ): Promise<string | null> {
    this.validateIdentifier(service, "service");
    this.validateIdentifier(account, "account");
    const store = await this.readStore();
    return store[service]?.[account] ?? null;
  }

  /**
   * Stores a password in the encrypted file store.
   * Creates the storage file and encryption key if they don't exist.
   *
   * @param service - The service identifier
   * @param account - The account identifier
   * @param password - The password to store
   */
  public async setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void> {
    this.validateIdentifier(service, "service");
    this.validateIdentifier(account, "account");
    this.validatePassword(password);
    const file = this.filePath;
    await this.ensureDir(path.dirname(file));
    const store = await this.readStore();
    const serviceEntry = store[service] ?? {};
    serviceEntry[account] = password;
    store[service] = serviceEntry;
    await this.writeStore(store);
  }

  /**
   * Deletes a password from the encrypted file store.
   *
   * @param service - The service identifier
   * @param account - The account identifier
   * @throws {PasswordDeleteError} If the password does not exist
   */
  public async deletePassword(service: string, account: string): Promise<void> {
    this.validateIdentifier(service, "service");
    this.validateIdentifier(account, "account");
    const store = await this.readStore();
    const serviceEntry = store[service];
    if (!serviceEntry || !(account in serviceEntry)) {
      throw new PasswordDeleteError("Password not found");
    }
    delete serviceEntry[account];
    if (Object.keys(serviceEntry).length === 0) {
      delete store[service];
    } else {
      store[service] = serviceEntry;
    }
    await this.writeStore(store);
  }

  protected async lookupUsernames(service: string): Promise<string[]> {
    const store = await this.readStore();
    const serviceEntry = store[service];
    return serviceEntry ? Object.keys(serviceEntry) : [];
  }

  private async readStore(): Promise<Record<string, Record<string, string>>> {
    const file = this.filePath;
    try {
      const data = await fs.readFile(file);
      return this.decryptStore(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  private async atomicWrite(file: string, buf: Buffer): Promise<void> {
    const dir = path.dirname(file);
    await this.ensureDir(dir);
    const tmp = path.join(
      dir,
      `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.writeFile(tmp, buf, { mode: 0o600 });
    await fs.rename(tmp, file);
  }

  private async writeStore(
    store: Record<string, Record<string, string>>,
  ): Promise<void> {
    const file = this.filePath;
    const encrypted = await this.encryptStore(store);
    await this.atomicWrite(file, encrypted);
  }
}
