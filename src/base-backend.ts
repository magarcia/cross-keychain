import { promises as fs } from "fs";
import { KeyringError } from "./errors.js";
import type {
  SecretStorageBackend,
  BackendFactory,
  Credential,
} from "./types.js";

const ENV_PROPERTY_PREFIX = "KEYRING_PROPERTY_";

/**
 * Abstract base class for all keyring backends.
 * Provides common functionality for property management, validation, and credential handling.
 * Backends extend this class and implement the core storage operations.
 */
export abstract class ConfigurableBackend implements SecretStorageBackend {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly priority: number;
  protected readonly properties: Record<string, unknown>;

  /**
   * Creates a new backend instance with optional configuration properties.
   * Properties can be overridden by environment variables prefixed with KEYRING_PROPERTY_.
   *
   * @param properties - Optional configuration properties for this backend
   */
  public constructor(properties?: Record<string, unknown>) {
    this.properties = { ...(properties ?? {}) };
    this.applyEnvOverrides();
  }

  public abstract getPassword(
    service: string,
    account: string,
  ): Promise<string | null>;

  public abstract setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void>;

  public abstract deletePassword(
    service: string,
    account: string,
  ): Promise<void>;

  /**
   * Retrieves a credential (username and password) for a service.
   * If account is specified, retrieves that specific credential.
   * If account is not specified, returns the first credential found for the service.
   *
   * @param service - The service identifier
   * @param account - Optional account/username identifier
   * @returns The credential object, or null if not found
   */
  public async getCredential(
    service: string,
    account?: string | null,
  ): Promise<Credential | null> {
    if (account) {
      const password = await this.getPassword(service, account);
      return password === null ? null : { username: account, password };
    }

    const usernames = await this.lookupUsernames(service);
    const username = usernames[0];
    if (!username) {
      return null;
    }
    const password = await this.getPassword(service, username);
    return password === null ? null : { username, password };
  }

  /**
   * Creates a new instance of this backend with merged properties.
   * Useful for runtime configuration changes without recreating the backend registry.
   *
   * @param properties - Properties to merge with the current backend's properties
   * @returns A new backend instance with the merged properties
   */
  public withProperties(
    properties: Record<string, unknown>,
  ): SecretStorageBackend {
    const ctor = this.constructor as BackendFactory;
    return new ctor({ ...this.properties, ...properties });
  }

  /**
   * Returns diagnostic information about this backend.
   * Includes backend ID, name, and priority. Subclasses can override to add more details.
   *
   * @returns Diagnostic information as key-value pairs
   */
  public async diagnose(): Promise<Record<string, unknown>> {
    return {
      name: this.name,
      id: this.id,
      priority: this.priority,
    };
  }

  protected async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  }

  protected applyEnvOverrides(): void {
    const entries = Object.entries(process.env)
      .filter(([key]) => key.startsWith(ENV_PROPERTY_PREFIX))
      .map(([key, value]) => ({
        property: key.replace(ENV_PROPERTY_PREFIX, "").toLowerCase(),
        value,
      }))
      .filter(
        (entry): entry is { property: string; value: string } =>
          entry.value !== undefined,
      );

    for (const { property, value } of entries) {
      this.properties[property] = value;
    }
  }

  protected async lookupUsernames(_service: string): Promise<string[]> {
    return [];
  }

  protected normalizeString(value: string): string {
    return value.normalize("NFC");
  }

  protected validateIdentifier(value: string, name: string): void {
    const normalized = this.normalizeString(value);

    if (!normalized || normalized.length === 0) {
      throw new KeyringError(`${name} cannot be empty`);
    }

    if (normalized.length > 255) {
      throw new KeyringError(
        `${name} exceeds maximum length of 255 characters`,
      );
    }

    const identifierPattern = /^[a-zA-Z0-9._@-]+$/;
    if (!identifierPattern.test(normalized)) {
      throw new KeyringError(
        `${name} contains invalid characters. Only alphanumeric characters, dots, underscores, @ symbols, and hyphens are allowed`,
      );
    }
  }

  protected validatePassword(password: string): void {
    const normalized = this.normalizeString(password);

    if (!normalized || normalized.length === 0) {
      throw new KeyringError("Password cannot be empty");
    }

    if (normalized.length > 4096) {
      throw new KeyringError(
        "Password exceeds maximum length of 4096 characters",
      );
    }
  }
}
