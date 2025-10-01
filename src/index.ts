import { promises as fs } from "fs";
import { KeyringError } from "./errors.js";
import {
  getConfigFile,
  getConfigRoot,
  getDataRoot,
  ensureParent,
} from "./config.js";
import { runtime, __resetRuntimeForTests } from "./runtime.js";
import {
  getKeyring,
  initBackend,
  getAllBackends,
  setKeyring,
  registerBackend,
  loadBackendById,
  __resetRegistryForTests,
} from "./registry.js";
import { NativeKeychainBackend } from "./backends/native-macos.js";
import { NativeWindowsBackend } from "./backends/native-windows.js";
import { NativeLinuxBackend } from "./backends/native-linux.js";
import { MacOSKeychainBackend } from "./backends/macos.js";
import { SecretServiceBackend } from "./backends/linux.js";
import { WindowsCredentialBackend } from "./backends/windows.js";
import { FileSystemBackend } from "./backends/file.js";
import { NullBackend } from "./backends/null.js";

export {
  KeyringError,
  PasswordSetError,
  PasswordDeleteError,
  InitError,
  KeyringLockedError,
  NoKeyringError,
} from "./errors.js";

export type {
  Credential,
  SecretStorageBackend,
  BackendFactory,
  BackendLimit,
  BackendInfo,
  CommandResult,
  CommandOptions,
  RuntimeFunctions,
} from "./types.js";

export type { KeyringConfig } from "./types.js";

interface TestingExports {
  runCommand: typeof runtime.runCommand;
  executableExists: typeof runtime.executableExists;
  runPowerShell: typeof runtime.runPowerShell;
  NativeKeychainBackend: typeof NativeKeychainBackend;
  NativeWindowsBackend: typeof NativeWindowsBackend;
  NativeLinuxBackend: typeof NativeLinuxBackend;
  MacOSKeychainBackend: typeof MacOSKeychainBackend;
  SecretServiceBackend: typeof SecretServiceBackend;
  WindowsCredentialBackend: typeof WindowsCredentialBackend;
  FileSystemBackend: typeof FileSystemBackend;
  NullBackend: typeof NullBackend;
}

const testingExports = {
  runCommand: runtime.runCommand,
  executableExists: runtime.executableExists,
  runPowerShell: runtime.runPowerShell,
  NativeKeychainBackend,
  NativeWindowsBackend,
  NativeLinuxBackend,
  MacOSKeychainBackend,
  SecretServiceBackend,
  WindowsCredentialBackend,
  FileSystemBackend,
  NullBackend,
};

export const __testing: TestingExports =
  process.env.NODE_ENV === "test" ? testingExports : (undefined as never);

export { registerBackend, getAllBackends, setKeyring, getKeyring, initBackend };

/**
 * Returns the root directory where keyring data is stored.
 * This is typically platform-specific (e.g., ~/.local/share/cross-keychain on Linux).
 *
 * @returns The absolute path to the data root directory
 */
export function dataRoot(): string {
  return getDataRoot();
}

/**
 * Returns the root directory where keyring configuration is stored.
 * This is typically platform-specific (e.g., ~/.config/cross-keychain on Linux).
 *
 * @returns The absolute path to the config root directory
 */
export function configRoot(): string {
  return getConfigRoot();
}

/**
 * Retrieves a password from the keyring.
 * This is the primary method for reading stored credentials.
 *
 * @param service - The service identifier (e.g., "github", "npm")
 * @param account - The account/username identifier
 * @returns The stored password, or null if not found
 *
 * @example
 * ```typescript
 * const password = await getPassword("github", "myusername");
 * if (password) {
 *   console.log("Password found!");
 * }
 * ```
 */
export async function getPassword(
  service: string,
  account: string,
): Promise<string | null> {
  const backend = await getKeyring();
  return backend.getPassword(service, account);
}

/**
 * Stores a password in the keyring.
 * If a password already exists for the service/account combination, it will be updated.
 *
 * @param service - The service identifier (e.g., "github", "npm")
 * @param account - The account/username identifier
 * @param password - The password to store
 *
 * @example
 * ```typescript
 * await setPassword("github", "myusername", "secret123");
 * ```
 */
export async function setPassword(
  service: string,
  account: string,
  password: string,
): Promise<void> {
  const backend = await getKeyring();
  await backend.setPassword(service, account, password);
}

/**
 * Deletes a password from the keyring.
 * Throws an error if the password does not exist.
 *
 * @param service - The service identifier
 * @param account - The account/username identifier
 *
 * @example
 * ```typescript
 * await deletePassword("github", "myusername");
 * ```
 */
export async function deletePassword(
  service: string,
  account: string,
): Promise<void> {
  const backend = await getKeyring();
  await backend.deletePassword(service, account);
}

/**
 * Retrieves a credential (username and password) from the keyring.
 * If account is not specified, returns the first credential found for the service.
 *
 * @param service - The service identifier
 * @param account - Optional account/username identifier
 * @returns The credential object with username and password, or null if not found
 *
 * @example
 * ```typescript
 * // Get specific credential
 * const cred = await getCredential("github", "myusername");
 *
 * // Get any credential for the service
 * const anyCred = await getCredential("github");
 * ```
 */
export async function getCredential(
  service: string,
  account?: string | null,
): Promise<import("./types.js").Credential | null> {
  const backend = await getKeyring();
  return backend.getCredential(service, account);
}

/**
 * Disables credential storage by configuring the null backend.
 * Creates a configuration file that prevents any credentials from being stored.
 * Throws an error if a configuration file already exists.
 */
export async function disable(): Promise<void> {
  const file = getConfigFile();
  try {
    await fs.access(file);
    throw new KeyringError(
      `Refusing to overwrite existing configuration at ${file}`,
    );
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  const config = {
    defaultBackend: "null",
  };
  await ensureParent(file);
  await fs.writeFile(file, JSON.stringify(config, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

/**
 * Returns diagnostic information about the current keyring configuration.
 * Useful for debugging and troubleshooting keyring issues.
 *
 * @returns An object containing configuration paths, active backend info, and platform details
 *
 * @example
 * ```typescript
 * const info = await diagnose();
 * console.log("Active backend:", info.name);
 * console.log("Config path:", info.configPath);
 * ```
 */
export async function diagnose(): Promise<Record<string, unknown>> {
  const backend = await getKeyring();
  const diagnosis = await backend.diagnose();
  return {
    configPath: getConfigFile(),
    dataRoot: getDataRoot(),
    ...diagnosis,
  };
}

/**
 * Resets all keyring state for testing purposes.
 * Internal function used by the test suite to ensure test isolation.
 */
export function __resetKeyringStateForTests(): void {
  __resetRuntimeForTests();
  __resetRegistryForTests();
}

/**
 * Lists all available keyring backends with their metadata.
 * Includes backend ID, name, and priority for each detected backend.
 *
 * @returns Array of backend information objects
 *
 * @example
 * ```typescript
 * const backends = await listBackends();
 * backends.forEach(b => {
 *   console.log(`${b.id}: ${b.name} (priority: ${b.priority})`);
 * });
 * ```
 */
export async function listBackends(): Promise<
  import("./types.js").BackendInfo[]
> {
  const backends = await getAllBackends();
  return backends.map((backend) => ({
    id: backend.id,
    name: backend.name,
    priority: backend.priority,
  }));
}

/**
 * Forces the use of a specific backend by ID.
 * Useful for testing or when you want to use a specific storage mechanism.
 * Throws an error if the backend is not available.
 *
 * @param backendId - The ID of the backend to use (e.g., "macos", "file", "null")
 * @param overrides - Optional configuration properties for the backend
 *
 * @example
 * ```typescript
 * // Use file backend with custom path
 * await useBackend("file", { file_path: "/custom/path/secrets.json" });
 * ```
 */
export async function useBackend(
  backendId: string,
  overrides?: Record<string, unknown>,
): Promise<void> {
  const backend = await loadBackendById(backendId, undefined, overrides);
  if (!backend) {
    const { NoKeyringError } = await import("./errors.js");
    throw new NoKeyringError(`Backend ${backendId} is not available`);
  }
  setKeyring(backend);
}
