import { PasswordDeleteError } from "../errors.js";
import { ConfigurableBackend } from "../base-backend.js";

/**
 * A no-op backend that does not store any credentials.
 * Used when credential storage needs to be explicitly disabled.
 * All get operations return null, set operations succeed silently, and delete operations throw errors.
 * This backend has a negative priority so it's only used when explicitly configured.
 */
export class NullBackend extends ConfigurableBackend {
  public readonly id = "null";
  public readonly name = "Null keyring";
  public readonly priority = -1;

  /**
   * Always returns null, as no credentials are stored.
   *
   * @param _service - The service identifier (unused)
   * @param _account - The account identifier (unused)
   * @returns Always returns null
   */
  public async getPassword(
    _service: string,
    _account: string,
  ): Promise<string | null> {
    return null;
  }

  /**
   * Silently succeeds without storing anything.
   *
   * @param _service - The service identifier (unused)
   * @param _account - The account identifier (unused)
   * @param _password - The password (unused)
   */
  public async setPassword(
    _service: string,
    _account: string,
    _password: string,
  ): Promise<void> {
    // Intentionally left blank
  }

  /**
   * Always throws an error, as there are no stored credentials to delete.
   *
   * @param _service - The service identifier (unused)
   * @param _account - The account identifier (unused)
   * @throws {PasswordDeleteError} Always thrown since no passwords are stored
   */
  public async deletePassword(
    _service: string,
    _account: string,
  ): Promise<void> {
    throw new PasswordDeleteError("Null backend does not store passwords");
  }
}
