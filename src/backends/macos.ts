import {
  KeyringError,
  PasswordSetError,
  PasswordDeleteError,
} from "../errors.js";
import { ConfigurableBackend } from "../base-backend.js";
import { runtime } from "../runtime.js";

/**
 * Backend for macOS Keychain using the `security` command-line tool.
 * Stores credentials in the system keychain using generic password items.
 * Supports custom keychain paths via the `keychain` property.
 */
export class MacOSKeychainBackend extends ConfigurableBackend {
  public readonly id = "macos";
  public readonly name = "macOS Keychain (CLI)";
  public readonly priority = 5;

  /**
   * Checks if this backend is supported on the current platform.
   * Requires macOS and the `security` command-line tool.
   *
   * @returns True if macOS and security tool are available
   */
  public static async isSupported(): Promise<boolean> {
    return (
      process.platform === "darwin" &&
      (await runtime.executableExists("security"))
    );
  }

  private get keychain(): string | undefined {
    const kc = this.properties["keychain"];
    return typeof kc === "string" && kc.length ? kc : undefined;
  }

  /**
   * Retrieves a password from the macOS Keychain.
   * Uses the `security find-generic-password` command.
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
    const args = ["find-generic-password", "-s", service, "-a", account, "-w"];
    this.appendKeychain(args);
    const result = await runtime.runCommand("security", args, {
      timeoutMs: 10000,
    });
    if (result.code === 44) {
      return null;
    }
    if (result.code !== 0) {
      throw new KeyringError(
        `Keychain operation failed with code ${result.code}`,
      );
    }
    return result.stdout.trim();
  }

  /**
   * Stores a password in the macOS Keychain.
   * Uses the `security add-generic-password` command with the -U flag to update existing entries.
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
      "add-generic-password",
      "-s",
      service,
      "-a",
      account,
      "-U",
      "-w",
      password,
    ];
    this.appendKeychain(args);
    const result = await runtime.runCommand("security", args, {
      timeoutMs: 10000,
    });
    if (result.code !== 0) {
      throw new PasswordSetError(
        `Keychain operation failed with code ${result.code}`,
      );
    }
  }

  /**
   * Deletes a password from the macOS Keychain.
   * Uses the `security delete-generic-password` command.
   *
   * @param service - The service identifier
   * @param account - The account identifier
   * @throws {PasswordDeleteError} If the password does not exist
   */
  public async deletePassword(service: string, account: string): Promise<void> {
    this.validateIdentifier(service, "service");
    this.validateIdentifier(account, "account");
    const args = ["delete-generic-password", "-s", service, "-a", account];
    this.appendKeychain(args);
    const result = await runtime.runCommand("security", args, {
      timeoutMs: 10000,
    });
    if (result.code === 44) {
      throw new PasswordDeleteError("Password not found");
    }
    if (result.code !== 0) {
      throw new PasswordDeleteError(
        `Keychain operation failed with code ${result.code}`,
      );
    }
  }

  protected async lookupUsernames(service: string): Promise<string[]> {
    const args = ["find-generic-password", "-s", service];
    this.appendKeychain(args);
    const result = await runtime.runCommand("security", args, {
      timeoutMs: 10000,
    });
    if (result.code !== 0) {
      return [];
    }
    const matches = [...result.stdout.matchAll(/"acct"<blob>="([^"]+)"/g)];
    return matches.map((match) => match[1]);
  }

  /**
   * Returns diagnostic information about this backend.
   * Includes the keychain path being used (or "default" for the system keychain).
   *
   * @returns Diagnostic information including backend details and keychain path
   */
  public override async diagnose(): Promise<Record<string, unknown>> {
    const details = await super.diagnose();
    return {
      ...details,
      keychain: this.keychain ?? "default",
    };
  }

  private appendKeychain(args: string[]): void {
    if (this.keychain) {
      args.push(this.keychain);
    }
  }
}
