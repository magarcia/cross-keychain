/**
 * Represents a credential with username and password.
 */
export interface Credential {
  username: string;
  password: string;
}

/**
 * The core interface that all keyring backends must implement.
 * Provides methods for storing, retrieving, and deleting passwords securely.
 */
export interface SecretStorageBackend {
  /** Unique identifier for this backend */
  readonly id: string;
  /** Human-readable name describing this backend */
  readonly name: string;
  /** Priority for automatic backend selection (higher values are preferred) */
  readonly priority: number;

  /**
   * Retrieves a password for the specified service and account.
   *
   * @param service - The service identifier
   * @param account - The account/username identifier
   * @returns The stored password, or null if not found
   */
  getPassword(service: string, account: string): Promise<string | null>;

  /**
   * Stores a password for the specified service and account.
   *
   * @param service - The service identifier
   * @param account - The account/username identifier
   * @param password - The password to store
   */
  setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void>;

  /**
   * Deletes a stored password for the specified service and account.
   *
   * @param service - The service identifier
   * @param account - The account/username identifier
   */
  deletePassword(service: string, account: string): Promise<void>;

  /**
   * Retrieves a credential (username and password) for a service.
   * If account is not specified, returns the first credential found for the service.
   *
   * @param service - The service identifier
   * @param account - Optional account/username identifier
   * @returns The credential object, or null if not found
   */
  getCredential(
    service: string,
    account?: string | null,
  ): Promise<Credential | null>;

  /**
   * Creates a new instance of this backend with updated properties.
   * Used for runtime configuration of backends.
   *
   * @param properties - Configuration properties to merge with existing ones
   * @returns A new backend instance with the merged properties
   */
  withProperties(properties: Record<string, unknown>): SecretStorageBackend;

  /**
   * Returns diagnostic information about this backend's configuration and state.
   * Useful for debugging and troubleshooting.
   *
   * @returns Diagnostic information as key-value pairs
   */
  diagnose(): Promise<Record<string, unknown>>;
}

/**
 * Factory function interface for creating backend instances.
 * Backends can optionally provide an isSupported method to check platform compatibility.
 */
export interface BackendFactory {
  new (properties?: Record<string, unknown>): SecretStorageBackend;
  isSupported?: () => boolean | Promise<boolean>;
  readonly prototype: SecretStorageBackend;
}

/**
 * Function type for filtering which backends are allowed.
 * Used to restrict backend selection based on custom criteria.
 */
export type BackendLimit = (backend: SecretStorageBackend) => boolean;

/**
 * Basic information about an available backend.
 * Used when listing available backends to users.
 */
export interface BackendInfo {
  /** Unique identifier for this backend */
  id: string;
  /** Human-readable name describing this backend */
  name: string;
  /** Priority for automatic backend selection (higher values are preferred) */
  priority: number;
}

/**
 * Configuration file format for persistent backend selection.
 */
export interface KeyringConfig {
  /** ID of the backend to use by default */
  defaultBackend?: string;
  /** Backend-specific configuration properties */
  backendProperties?: Record<string, Record<string, unknown>>;
}

/**
 * Result from executing a system command.
 */
export type CommandResult = {
  /** Exit code from the command */
  code: number;
  /** Standard output from the command */
  stdout: string;
  /** Standard error from the command */
  stderr: string;
};

/**
 * Options for executing system commands.
 */
export type CommandOptions = {
  /** Input to pipe to stdin */
  input?: string;
  /** Environment variables for the command */
  env?: NodeJS.ProcessEnv;
  /** Working directory for the command */
  cwd?: string;
  /** Maximum execution time in milliseconds */
  timeoutMs?: number;
};

/**
 * Interface for system command execution utilities.
 * Used by backends to interact with platform-specific tools.
 */
export interface RuntimeFunctions {
  /**
   * Executes a system command with arguments.
   *
   * @param command - The command to execute
   * @param args - Command arguments
   * @param options - Execution options
   * @returns Command execution result
   */
  runCommand: (
    command: string,
    args: string[],
    options?: CommandOptions,
  ) => Promise<CommandResult>;

  /**
   * Checks if an executable exists in the system PATH.
   *
   * @param command - The command name to check
   * @returns True if the command exists, false otherwise
   */
  executableExists: (command: string) => Promise<boolean>;

  /**
   * Executes a PowerShell script (Windows-specific).
   *
   * @param script - The PowerShell script to execute
   * @param options - Execution options
   * @returns Command execution result
   */
  runPowerShell: (
    script: string,
    options?: CommandOptions,
  ) => Promise<CommandResult>;
}
