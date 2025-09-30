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
 * Backend for macOS Keychain using native bindings via @napi-rs/keyring.
 * This backend provides the best performance and integration with macOS Keychain.
 * Falls back gracefully to CLI-based backend if native module is not available.
 * Has the highest priority among macOS backends.
 */
export class NativeKeychainBackend extends ConfigurableBackend {
  public readonly id = "native-macos";
  public readonly name = "Native macOS Keychain";
  public readonly priority = 10;

  /**
   * Checks if this backend is supported on the current platform.
   * Requires macOS and the @napi-rs/keyring native module.
   *
   * @returns True if macOS and the native module are available
   */
  public static async isSupported(): Promise<boolean> {
    if (process.platform !== "darwin") return false;
    await loadNativeModule();
    return NativeKeyringEntry !== null;
  }

  /**
   * Retrieves a password from macOS Keychain using native bindings.
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
      throw new KeyringError(`Native keychain error: ${message}`);
    }
  }

  /**
   * Stores a password in macOS Keychain using native bindings.
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
      throw new PasswordSetError(`Native keychain error: ${message}`);
    }
  }

  /**
   * Deletes a password from macOS Keychain using native bindings.
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
      throw new PasswordDeleteError(`Native keychain error: ${message}`);
    }
  }

  /**
   * Lists all usernames stored for a given service.
   * Uses the @napi-rs/keyring findCredentials API.
   *
   * @param service - The service identifier
   * @returns Array of usernames that have credentials stored for this service
   */
  protected async lookupUsernames(service: string): Promise<string[]> {
    if (!NativeKeyringEntry) {
      return [];
    }

    try {
      // Import findCredentials dynamically
      const { findCredentials } = await import("@napi-rs/keyring");
      const credentials = findCredentials(service);
      return credentials.map((cred) => cred.account);
    } catch {
      // If findCredentials fails or is not available, return empty array
      return [];
    }
  }

  /**
   * Returns diagnostic information about this backend.
   * Includes information about the native implementation and fallback availability.
   *
   * @returns Diagnostic information including implementation details
   */
  public override async diagnose(): Promise<Record<string, unknown>> {
    const details = await super.diagnose();

    const { MacOSKeychainBackend } = await import("./macos.js");

    return {
      ...details,
      implementation: "Native Security.framework bindings",
      fallbackAvailable: await MacOSKeychainBackend.isSupported(),
    };
  }
}
