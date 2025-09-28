import {
  KeyringError,
  PasswordSetError,
  PasswordDeleteError,
} from "../errors.js";
import { ConfigurableBackend } from "../base-backend.js";
import { runtime } from "../runtime.js";

/**
 * Backend for Linux Secret Service using the `secret-tool` command.
 * Implements the Freedesktop Secret Service specification.
 * Compatible with GNOME Keyring, KWallet, and other Secret Service implementations.
 * Supports custom application IDs and collection names via properties.
 */
export class SecretServiceBackend extends ConfigurableBackend {
  public readonly id = "secret-service";
  public readonly name = "Freedesktop Secret Service";
  public readonly priority = 4.8;

  /**
   * Checks if this backend is supported on the current platform.
   * Requires Linux and the `secret-tool` command.
   *
   * @returns True if Linux and secret-tool are available
   */
  public static async isSupported(): Promise<boolean> {
    return (
      process.platform === "linux" &&
      (await runtime.executableExists("secret-tool"))
    );
  }

  private get appId(): string {
    const value = this.properties["application"] ?? this.properties["appid"];
    return typeof value === "string" && value.length ? value : "ts-keyring";
  }

  private get collection(): string | undefined {
    const value =
      this.properties["collection"] ?? this.properties["preferred_collection"];
    return typeof value === "string" && value.length ? value : undefined;
  }

  /**
   * Retrieves a password from the Secret Service.
   * Uses the `secret-tool lookup` command with service, username, and application attributes.
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

    const args = [
      "lookup",
      "service",
      service,
      "username",
      account,
      "application",
      this.appId,
    ];
    if (this.collection) {
      args.splice(1, 0, `--collection=${this.collection}`);
    }
    const result = await runtime.runCommand("secret-tool", args, {
      timeoutMs: 10000,
    });
    if (result.code === 1) {
      return null;
    }
    if (result.code !== 0) {
      throw new KeyringError(
        `Secret service operation failed with code ${result.code}`,
      );
    }
    return result.stdout.replace(/\r?\n$/, "");
  }

  /**
   * Stores a password in the Secret Service.
   * Uses the `secret-tool store` command with a descriptive label.
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

    const args = [
      "store",
      "--label",
      `Password for '${account.replace(/'/g, "\\'")}' on '${service.replace(/'/g, "\\'")}' (${this.appId})`,
    ];
    if (this.collection) {
      args.push(`--collection=${this.collection}`);
    }
    args.push(
      "service",
      service,
      "username",
      account,
      "application",
      this.appId,
    );
    const result = await runtime.runCommand("secret-tool", args, {
      input: `${password}\n`,
      timeoutMs: 10000,
    });
    if (result.code !== 0) {
      throw new PasswordSetError(
        `Secret service operation failed with code ${result.code}`,
      );
    }
  }

  /**
   * Deletes a password from the Secret Service.
   * Uses the `secret-tool clear` command.
   *
   * @param service - The service identifier
   * @param account - The account identifier
   * @throws {PasswordDeleteError} If the password does not exist
   */
  public async deletePassword(service: string, account: string): Promise<void> {
    this.validateIdentifier(service, "service");
    this.validateIdentifier(account, "account");

    const args = [
      "clear",
      "service",
      service,
      "username",
      account,
      "application",
      this.appId,
    ];
    if (this.collection) {
      args.splice(1, 0, `--collection=${this.collection}`);
    }
    const result = await runtime.runCommand("secret-tool", args, {
      timeoutMs: 10000,
    });
    if (result.code === 1) {
      throw new PasswordDeleteError("Password not found");
    }
    if (result.code !== 0) {
      throw new PasswordDeleteError(
        `Secret service operation failed with code ${result.code}`,
      );
    }
  }

  protected async lookupUsernames(service: string): Promise<string[]> {
    this.validateIdentifier(service, "service");

    const args = ["search", "service", service, "application", this.appId];
    if (this.collection) {
      args.splice(1, 0, `--collection=${this.collection}`);
    }
    const result = await runtime.runCommand("secret-tool", args, {
      timeoutMs: 10000,
    });
    if (result.code !== 0) {
      return [];
    }
    const usernames = new Set<string>();
    for (const line of result.stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const parts = trimmed.split("=");
      if (parts.length < 2) {
        continue;
      }
      const key = parts[0].trim().toLowerCase();
      const value = parts.slice(1).join("=").trim();
      if (key.endsWith("username") && value) {
        usernames.add(value);
      }
    }
    return Array.from(usernames);
  }
}
