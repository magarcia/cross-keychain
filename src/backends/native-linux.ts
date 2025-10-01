import {
  KeyringError,
  PasswordSetError,
  PasswordDeleteError,
} from "../errors.js";
import { ConfigurableBackend } from "../base-backend.js";

let NativeKeyringEntry: typeof import("@napi-rs/keyring").Entry | null = null;
let nativeModuleLoadAttempted = false;

async function loadNativeModule(): Promise<void> {
  if (nativeModuleLoadAttempted) return;
  nativeModuleLoadAttempted = true;

  try {
    const nativeModule = await import("@napi-rs/keyring");
    NativeKeyringEntry = nativeModule.Entry;
  } catch {
    NativeKeyringEntry = null;
  }
}

/**
 * Backend for Freedesktop Secret Service using native bindings via @napi-rs/keyring.
 * This backend provides the best performance and security by directly accessing the
 * Secret Service D-Bus API through native bindings. Falls back gracefully to
 * secret-tool based backend if native module is not available.
 * Has the highest priority among Linux backends.
 */
export class NativeLinuxBackend extends ConfigurableBackend {
  public readonly id = "native-linux";
  public readonly name = "Native Freedesktop Secret Service";
  public readonly priority = 10;

  /**
   * Checks if this backend is supported on the current platform.
   * Requires Linux and the @napi-rs/keyring native module.
   *
   * @returns True if Linux and the native module are available
   */
  public static async isSupported(): Promise<boolean> {
    if (process.platform !== "linux") return false;
    await loadNativeModule();
    return NativeKeyringEntry !== null;
  }

  /**
   * Retrieves a password from the Secret Service using native bindings.
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

    if (!NativeKeyringEntry) {
      throw new KeyringError("Native keyring module not available");
    }

    try {
      const entry = new NativeKeyringEntry(service, account);
      return entry.getPassword();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("not found") ||
        message.includes("No such") ||
        message.includes("not exist")
      ) {
        return null;
      }
      throw new KeyringError(`Native secret service error: ${message}`);
    }
  }

  /**
   * Stores a password in the Secret Service using native bindings.
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

    if (!NativeKeyringEntry) {
      throw new KeyringError("Native keyring module not available");
    }

    try {
      const entry = new NativeKeyringEntry(service, account);
      entry.setPassword(password);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new PasswordSetError(`Native secret service error: ${message}`);
    }
  }

  /**
   * Deletes a password from the Secret Service using native bindings.
   *
   * @param service - The service identifier
   * @param account - The account identifier
   * @throws {PasswordDeleteError} If the password does not exist
   */
  public async deletePassword(service: string, account: string): Promise<void> {
    this.validateIdentifier(service, "service");
    this.validateIdentifier(account, "account");

    if (!NativeKeyringEntry) {
      throw new KeyringError("Native keyring module not available");
    }

    const exists = await this.getPassword(service, account);
    if (exists === null) {
      throw new PasswordDeleteError("Password not found");
    }

    try {
      const entry = new NativeKeyringEntry(service, account);
      entry.deletePassword();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new PasswordDeleteError(`Native secret service error: ${message}`);
    }
  }

  /**
   * Lists all usernames stored for a given service.
   * Note: The @napi-rs/keyring library does not support credential enumeration.
   *
   * @param _service - The service identifier
   * @returns Empty array (enumeration not supported by native backend)
   */
  protected async lookupUsernames(_service: string): Promise<string[]> {
    return [];
  }

  /**
   * Returns diagnostic information about this backend.
   * Includes information about the native implementation and fallback availability.
   *
   * @returns Diagnostic information including implementation details
   */
  public override async diagnose(): Promise<Record<string, unknown>> {
    const details = await super.diagnose();

    const { SecretServiceBackend } = await import("./linux.js");

    return {
      ...details,
      implementation: "Native DBus bindings",
      fallbackAvailable: await SecretServiceBackend.isSupported(),
    };
  }
}
