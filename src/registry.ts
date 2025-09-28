import { InitError, NoKeyringError } from "./errors.js";
import type {
  SecretStorageBackend,
  BackendFactory,
  BackendLimit,
} from "./types.js";
import { readConfig } from "./config.js";
import { NativeKeychainBackend } from "./backends/native-macos.js";
import { MacOSKeychainBackend } from "./backends/macos.js";
import { SecretServiceBackend } from "./backends/linux.js";
import { WindowsCredentialBackend } from "./backends/windows.js";
import { FileSystemBackend } from "./backends/file.js";
import { NullBackend } from "./backends/null.js";

const ENV_BACKEND = "TS_KEYRING_BACKEND";

let cachedBackends: SecretStorageBackend[] | undefined;
let activeBackend: SecretStorageBackend | undefined;
let backendLimit: BackendLimit | undefined;

const builtinFactories: BackendFactory[] = [
  NativeKeychainBackend,
  MacOSKeychainBackend,
  SecretServiceBackend,
  WindowsCredentialBackend,
  FileSystemBackend,
  NullBackend,
];

async function instantiate(
  factory: BackendFactory,
): Promise<SecretStorageBackend | null> {
  if (factory.isSupported) {
    const supported = await factory.isSupported();
    if (!supported) {
      return null;
    }
  }
  try {
    return new factory();
  } catch (error: unknown) {
    if (error instanceof InitError) {
      return null;
    }
    throw error;
  }
}

/**
 * Registers a custom backend factory with the keyring system.
 * The backend will be added to the list of available backends for automatic detection.
 *
 * @param factory - The backend factory class to register
 *
 * @example
 * ```typescript
 * class CustomBackend extends ConfigurableBackend {
 *   // ... implementation
 * }
 * registerBackend(CustomBackend);
 * ```
 */
export function registerBackend(factory: BackendFactory): void {
  builtinFactories.push(factory);
  cachedBackends = undefined;
}

/**
 * Returns all available backends that are supported on the current platform.
 * Backends are instantiated and cached on first call.
 * Unsupported backends are filtered out based on their isSupported() method.
 *
 * @returns Array of all supported backend instances
 */
export async function getAllBackends(): Promise<SecretStorageBackend[]> {
  if (!cachedBackends) {
    const instances = await Promise.all(
      builtinFactories.map((factory) => instantiate(factory)),
    );
    cachedBackends = instances.filter(Boolean) as SecretStorageBackend[];
  }
  return cachedBackends;
}

/**
 * Sets the active keyring backend.
 * This overrides automatic backend detection and forces all operations to use this backend.
 *
 * @param backend - The backend instance to use
 */
export function setKeyring(backend: SecretStorageBackend): void {
  activeBackend = backend;
}

/**
 * Returns the currently active keyring backend.
 * If no backend is active, initializes one using automatic detection.
 * Detection order: environment variable, config file, platform detection.
 *
 * @returns The active backend instance
 * @throws {NoKeyringError} If no backend can be initialized
 */
export async function getKeyring(): Promise<SecretStorageBackend> {
  if (!activeBackend) {
    await initBackend(backendLimit);
  }
  if (!activeBackend) {
    throw new NoKeyringError("No keyring backend could be initialized");
  }
  return activeBackend;
}

/**
 * Initializes the active backend using automatic detection.
 * Detection order: environment variable (TS_KEYRING_BACKEND), config file, platform detection.
 *
 * @param limit - Optional filter function to restrict which backends are allowed
 */
export async function initBackend(limit?: BackendLimit): Promise<void> {
  backendLimit = limit;
  const backend =
    (await loadBackendFromEnv(limit)) ||
    (await loadBackendFromConfig(limit)) ||
    (await detectBackend(limit));
  activeBackend = backend;
}

async function loadBackendFromEnv(
  limit?: BackendLimit,
): Promise<SecretStorageBackend | null> {
  const backendId = process.env[ENV_BACKEND];
  if (!backendId) {
    return null;
  }
  const backend = await loadBackendById(backendId, limit);
  if (!backend) {
    throw new InitError(
      `Backend ${backendId} from ${ENV_BACKEND} is not available`,
    );
  }
  return backend;
}

async function loadBackendFromConfig(
  limit?: BackendLimit,
): Promise<SecretStorageBackend | null> {
  try {
    const config = await readConfig();
    if (!config.defaultBackend) {
      return null;
    }
    return loadBackendById(
      config.defaultBackend,
      limit,
      config.backendProperties?.[config.defaultBackend],
    );
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Loads a backend by its ID and optionally applies configuration overrides.
 * Returns null if the backend is not available or doesn't pass the limit filter.
 *
 * @param backendId - The ID of the backend to load (e.g., "macos", "file", "null")
 * @param limit - Optional filter function to check if backend is allowed
 * @param overrides - Optional configuration properties to apply to the backend
 * @returns The backend instance, or null if not available
 */
export async function loadBackendById(
  backendId: string,
  limit?: BackendLimit,
  overrides?: Record<string, unknown>,
): Promise<SecretStorageBackend | null> {
  const all = await getAllBackends();
  const backend = all.find((candidate) => candidate.id === backendId);
  if (!backend) {
    return null;
  }
  if (limit && !limit(backend)) {
    return null;
  }
  return overrides ? backend.withProperties(overrides) : backend;
}

async function detectBackend(
  limit?: BackendLimit,
): Promise<SecretStorageBackend> {
  const backends = await getAllBackends();
  const filtered = limit ? backends.filter(limit) : backends;
  if (!filtered.length) {
    return new NullBackend();
  }
  return filtered.reduce((selected, candidate) =>
    candidate.priority > selected.priority ? candidate : selected,
  );
}

/**
 * Resets all registry state for testing purposes.
 * Clears the backend cache, active backend, and backend limit.
 * Internal function used by the test suite to ensure test isolation.
 */
export function __resetRegistryForTests(): void {
  cachedBackends = undefined;
  activeBackend = undefined;
  backendLimit = undefined;
}
