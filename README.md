# cross-keychain

[![CI Status](https://github.com/magarcia/cross-keychain/workflows/CI/badge.svg)](https://github.com/magarcia/cross-keychain/actions)
[![codecov](https://codecov.io/gh/magarcia/cross-keychain/branch/main/graph/badge.svg)](https://codecov.io/gh/magarcia/cross-keychain)
[![npm version](https://badge.fury.io/js/cross-keychain.svg)](https://www.npmjs.com/package/cross-keychain)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Cross-platform secret storage for Node.js applications and CLI usage.

## Features

- Works across Windows, macOS, and Linux using native credential storage
- Secure storage using Windows Credential Manager, macOS Keychain, and Linux Secret Service
- **Native macOS Keychain integration** via Security.framework bindings for enhanced security (no password exposure in process lists)
- Automatic fallback to CLI-based backends when native modules unavailable
- Simple CLI interface for managing secrets
- TypeScript support with full type definitions
- Programmatic API for Node.js applications

## Installation

```sh
npm install cross-keychain
# or
yarn add cross-keychain
# or
pnpm add cross-keychain
```

## CLI Usage

Once installed, you can use the `cross-keychain` command to manage secrets:

### Basic Commands

```sh
# Store a secret (will prompt for password)
cross-keychain set myapp username
# Password for 'username' in 'myapp': [hidden input]
# Password stored

# Store a secret via stdin (non-interactive)
echo "my-secret" | cross-keychain set myapp username
# Password stored

# Retrieve a password
cross-keychain get myapp username
# my-secret

# Retrieve credentials as JSON
cross-keychain get myapp username --mode creds --output json
# {"username":"username","password":"my-secret"}

# Retrieve any credential for a service
cross-keychain get myapp --mode creds
# username
# my-secret

# Delete a secret
cross-keychain del myapp username
# Password deleted
```

### Advanced Options

```sh
# List available backends
cross-keychain --list-backends
# file	(priority: 1)	File backend
# keychain	(priority: 10)	macOS Keychain

# Force a specific backend
cross-keychain get myapp username --backend file

# Disable keyring (use null backend)
cross-keychain --disable
# Null backend configured

# Diagnose current configuration
cross-keychain diagnose
# {
#   "backend": "keychain",
#   "available_backends": [...]
# }
```

### Command Reference

**Operations:**

- `get` - Retrieve a password or credential
- `set` - Store a password (prompts securely or reads from stdin)
- `del` - Delete a password
- `diagnose` - Print environment details

**Options:**

- `--backend <id>` - Force a specific backend
- `--mode <mode>` - Mode for 'get' operation (`password` or `creds`)
- `--output <format>` - Output format for 'get' operation (`plain` or `json`)
- `--password-stdin` - Read password from stdin for 'set' operation
- `--list-backends` - List detected backends
- `--disable` - Persistently configure the null backend

## Programmatic Usage

```ts
import {
  setPassword,
  getPassword,
  deletePassword,
  getCredential,
} from "cross-keychain";

// Store a secret
await setPassword("myapp", "username", "john_doe");

// Retrieve a secret
const password = await getPassword("myapp", "username");
console.log(password); // "john_doe"

// Delete a secret
await deletePassword("myapp", "username");

// Get credential for a service and account
const credential = await getCredential("myapp", "username");
console.log(credential); // { username: "username", password: "john_doe" }

// Get first available credential for a service
const firstCredential = await getCredential("myapp");
console.log(firstCredential); // { username: "username", password: "john_doe" }
```

## API

### `setPassword(service, account, password)`

- `service` (`string`): The service name to store the password under
- `account` (`string`): The account name
- `password` (`string`): The password to store

Stores a password in the system keyring.

### `getPassword(service, account)`

- `service` (`string`): The service name
- `account` (`string`): The account name

Returns the stored password for the given service and account, or `null` if not found.

### `deletePassword(service, account)`

- `service` (`string`): The service name
- `account` (`string`): The account name

Deletes the stored password for the given service and account.

### `getCredential(service, account?)`

- `service` (`string`): The service name
- `account` (`string`, optional): The account name. If not provided, returns the first available credential for the service

Returns a credential object with `username` and `password` properties for the given service and account, or `null` if not found.

**Platform Limitations:**

- **Without account parameter:** Only supported on Linux (Secret Service), file backend, and CLI-based macOS Keychain
- **Windows and native macOS backends:** Require explicit account parameter
- Platform limitations are due to underlying credential API constraints

**Note**: If multiple credentials exist for the service, the one returned is not guaranteed to be the same every time.

## Configuration

Keyring supports various configuration methods to customize backend selection and behavior.

### Environment Variables

#### Force Backend Selection

**`TS_KEYRING_BACKEND`** - Forces a specific backend to be used:

```sh
# Force native macOS Keychain (Security.framework bindings - when available)
export TS_KEYRING_BACKEND=native-macos

# Force CLI-based macOS Keychain (security command - when available)
export TS_KEYRING_BACKEND=macos

# Force Windows Credential Manager (when available)
export TS_KEYRING_BACKEND=windows

# Force Linux Secret Service (when available)
export TS_KEYRING_BACKEND=secret-service

# Force the file backend
export TS_KEYRING_BACKEND=file

# Force the null backend (disables storage)
export TS_KEYRING_BACKEND=null
```

#### Backend Property Overrides

**`KEYRING_PROPERTY_*`** - Override backend-specific properties:

```sh
# File backend: Custom storage location
export KEYRING_PROPERTY_FILE_PATH="/custom/path/secrets.json"

# macOS backend: Use specific keychain
export KEYRING_PROPERTY_KEYCHAIN="/path/to/custom.keychain"

# Linux Secret Service: Custom application identifier
export KEYRING_PROPERTY_APPLICATION="my-custom-app"
export KEYRING_PROPERTY_APPID="my-custom-app"  # Alternative name

# Linux Secret Service: Use specific collection
export KEYRING_PROPERTY_COLLECTION="my-collection"
export KEYRING_PROPERTY_PREFERRED_COLLECTION="my-collection"  # Alternative name

# Windows: Set credential persistence level
export KEYRING_PROPERTY_PERSIST="local"  # or "session", "enterprise"
```

### Configuration File

Keyring uses a JSON configuration file for persistent settings:

**Location:** `keyring.config.json` in the platform-specific config directory:

- **Windows:** `%LOCALAPPDATA%\Keyring\keyring.config.json` or `%APPDATA%\Keyring\keyring.config.json`
- **macOS:** `~/.config/keyring/keyring.config.json` (or `$XDG_CONFIG_HOME/keyring/keyring.config.json`)
- **Linux:** `~/.config/keyring/keyring.config.json` (or `$XDG_CONFIG_HOME/keyring/keyring.config.json`)

**Schema:**

```json
{
  "defaultBackend": "file",
  "backendProperties": {
    "file": {
      "file_path": "/custom/path/secrets.json"
    },
    "native-macos": {
      "keychain": "/path/to/custom.keychain"
    },
    "macos": {
      "keychain": "/path/to/custom.keychain"
    },
    "secret-service": {
      "application": "my-app",
      "collection": "my-collection"
    },
    "windows": {
      "persist": "local"
    }
  }
}
```

**Example configurations:**

```json
// Disable keyring (use null backend)
{
  "defaultBackend": "null"
}

// Use file backend with custom location
{
  "defaultBackend": "file",
  "backendProperties": {
    "file": {
      "file_path": "/secure/vault/secrets.json"
    }
  }
}

// Use Windows Credential Manager with session persistence
{
  "defaultBackend": "windows",
  "backendProperties": {
    "windows": {
      "persist": "session"
    }
  }
}
```

### Backend-Specific Configuration

#### File Backend Properties

- **`file_path`** (`string`): Custom path for the secrets JSON file
  - Default: `{dataRoot}/secrets.json`
  - Example: `"/custom/path/secrets.json"`

- **`key_file_path`** (`string`): Custom path for the encryption key file
  - Default: `{configRoot}/file.key`
  - Example: `"/custom/path/file.key"`
  - **Environment variable:** `KEYRING_FILE_MASTER_KEY` - 64 hex character (32 byte) key to override file-based key

#### Native macOS Keychain Backend Properties

- **`keychain`** (`string`): Path to a specific keychain file
  - Default: Uses the default keychain
  - Example: `"/path/to/custom.keychain"`
  - **Note**: Requires @napi-rs/keyring optional dependency to be installed

#### macOS Keychain Backend (CLI) Properties

- **`keychain`** (`string`): Path to a specific keychain file
  - Default: Uses the default keychain
  - Example: `"/path/to/custom.keychain"`
  - **Note**: This is the CLI-based fallback when native bindings are unavailable

#### Linux Secret Service Backend Properties

- **`application`** / **`appid`** (`string`): Application identifier for stored secrets
  - Default: `"ts-keyring"`
  - Example: `"my-application"`

- **`collection`** / **`preferred_collection`** (`string`): Specific keyring collection to use
  - Default: Uses the default collection
  - Example: `"my-collection"`

#### Windows Credential Manager Backend Properties

- **`persist`** (`string` | `number`): Credential persistence level
  - **`"session"` / `1`**: Credentials are deleted when the user logs off
  - **`"local"` / `2`**: Credentials persist until explicitly deleted (default)
  - **`"enterprise"` / `3`**: Credentials roam with the user profile
  - Custom numeric values are also supported

### disable() Function

The `disable()` function creates a configuration file that forces the null backend:

```ts
import { disable } from "cross-keychain";

// Persistently disable keyring
await disable();
```

**Behavior:**

- Creates `keyring.config.json` with `"defaultBackend": "null"`
- Throws `KeyringError` if configuration file already exists
- All subsequent operations will use the null backend (no actual storage)
- File permissions are set to `0600` (owner read/write only)

**To re-enable keyring:** Delete the configuration file manually

### Configuration Priority

Keyring uses the following priority order for backend selection:

1. **Environment variable:** `TS_KEYRING_BACKEND` (highest priority)
2. **Configuration file:** `defaultBackend` setting
3. **Auto-detection:** Based on platform and backend availability (lowest priority)

Environment property overrides (`KEYRING_PROPERTY_*`) always take precedence over configuration file settings.

## Platform Support

- **Windows**: Uses native Windows Credential Manager bindings (via @napi-rs/keyring) with automatic fallback to PowerShell-based access
- **macOS**: Uses native Security.framework bindings (via @napi-rs/keyring) with automatic fallback to CLI-based Keychain Access
- **Linux**: Uses native Secret Service API bindings (via @napi-rs/keyring) with automatic fallback to secret-tool

### Backend Priority System

cross-keychain uses a priority-based system to automatically select the best available backend:

| Backend                               | Platform | Priority | Method                      | Security                                        |
| ------------------------------------- | -------- | -------- | --------------------------- | ----------------------------------------------- |
| Native macOS Keychain                 | macOS    | 10       | Security.framework bindings | ✅ Highest - Direct API access                  |
| Native Windows Credential Manager     | Windows  | 10       | Native DPAPI bindings       | ✅ Highest - Direct API access                  |
| Native Linux Secret Service           | Linux    | 10       | Native DBus bindings        | ✅ Highest - Direct API access                  |
| macOS Keychain (CLI Fallback)         | macOS    | 5        | `security` command          | ✅ High - OS keychain, password in process list |
| Windows Credential Manager (Fallback) | Windows  | 5        | PowerShell DPAPI            | ✅ High - OS credential manager                 |
| Linux Secret Service (Fallback)       | Linux    | 4.8      | `secret-tool`               | ✅ High - OS keyring service                    |
| File Backend                          | All      | 0.5      | Encrypted JSON file         | ⚠️ Limited - AES-256-GCM encrypted, file-based  |
| Null Backend                          | All      | -1       | No storage                  | ❌ None - Disabled                              |

The native backends (macOS, Windows, and Linux) use @napi-rs/keyring (installed as an optional dependency) for direct API access through native bindings, providing the highest security and performance. These backends eliminate password exposure in process lists and shell command injection risks that can occur with CLI-based approaches. If the native module is not available, the library automatically falls back to shell-based backends.

## Security Considerations

⚠️ **CRITICAL SECURITY WARNING** ⚠️

The security of your stored credentials depends entirely on which backend is used. **Always use native OS backends in production environments.**

### Secure Backends (Recommended for Production)

These backends use your operating system's built-in credential management and provide strong security:

**🔒 macOS Keychain (Native)**

- **Highest security**: Uses Security.framework bindings via @napi-rs/keyring
- **No password exposure**: Passwords never appear in process lists or command line arguments
- Hardware-encrypted storage when available (Secure Enclave on newer Macs)
- Integrates with macOS authentication policies and Touch ID/Face ID
- Passwords encrypted using your login keychain password
- Access restricted to your user account only
- **Automatic fallback**: Falls back to CLI-based keychain if native module unavailable

**🔒 macOS Keychain (CLI - Fallback)**

- Uses `security` command-line tool
- ⚠️ **Security caveat**: Passwords briefly visible in process lists during operations
- Same encryption and access controls as native backend
- Automatically selected when native module cannot be loaded

**🔒 Windows Credential Manager**

- Uses DPAPI (Data Protection API) encryption tied to your user account
- Integrates with Windows security policies and Windows Hello
- Automatic encryption/decryption handled by the OS
- Access restricted to your user account only

**🔒 Linux Secret Service**

- Encrypted storage with master password protection
- Integrates with GNOME Keyring or KDE Wallet
- Access restricted to your current user session
- Supports multiple keyrings and collections

### ⚠️ File Backend - LIMITED SECURITY

**WARNING**: The file backend provides encryption but has significant limitations compared to OS backends.

**Security features:**

- ✅ **AES-256-GCM encryption** with 96-bit IV and authentication tags
- ✅ **Per-user encryption key** stored in `~/.config/keyring/file.key` (0600 permissions)
- ✅ **Environment variable override**: Use `KEYRING_FILE_MASTER_KEY` env var for key management
- ✅ **Atomic writes**: Prevents corruption on crash/interrupt
- ✅ File and key file permissions set to `0600` (owner read/write only)
- ✅ Directory permissions set to `0700` (owner access only)

**Threat model - Protects against:**

- ✅ Casual access to the secrets file
- ✅ File corruption from interrupted writes
- ✅ Accidental exposure of plaintext secrets

**Security limitations:**

- ⚠️ Encryption key stored on same system as encrypted data
- ⚠️ Anyone with root/administrator access can read key file and decrypt
- ⚠️ **NOT a substitute for OS keychain** - lacks hardware security and OS integration
- ⚠️ Memory is not zeroized (keys may remain in memory/swap)
- ⚠️ No hardware security module or secure enclave protection
- ⚠️ **Not recommended for production or highly sensitive credentials**

**Key management:**

- Key file: `~/.config/keyring/file.key` (auto-generated if missing)
- Override with `KEYRING_FILE_MASTER_KEY` env var (64 hex chars = 32 bytes)
- Changing systems requires copying/regenerating key file

**Acceptable use cases:**

- Development and testing environments
- CI/CD pipelines where native backends are unavailable
- Non-sensitive credential storage
- Environments where you control key distribution

### CLI Security Best Practices

**Secure password input:**

- ✅ Use `cross-keychain set service username` (interactive prompt - secure)
- ✅ Use `cross-keychain set service username --password-stdin < file` (reads from stdin)
- ⚠️ Avoid `echo "password" | cross-keychain set service username` (may appear in process lists)

**Production recommendations:**

- **Always use native OS backends** (keychain, windows, secret-service)
- Never use file backend for production secrets
- Use environment variables or CI/CD secret management for automation
- Avoid command line password arguments

### Data Storage Locations

Credentials and configuration files are stored in platform-specific directories:

**Windows:**

- `%LOCALAPPDATA%\Keyring` or `%APPDATA%\Keyring`

**macOS:**

- Data: `~/.local/share/keyring` (or `$XDG_DATA_HOME/keyring`)
- Config: `~/.config/keyring` (or `$XDG_CONFIG_HOME/keyring`)

**Linux:**

- Data: `~/.local/share/keyring` (or `$XDG_DATA_HOME/keyring`)
- Config: `~/.config/keyring` (or `$XDG_CONFIG_HOME/keyring`)

## Testing & Development

This project uses modern development tools and practices. Here are the key npm scripts for contributors:

### Core Development Scripts

- **`npm run test`** – Run the complete Vitest test suite with coverage reporting
- **`npm run test:watch`** – Run tests in watch mode for active development
- **`npm run lint`** – Lint source code with ESLint to enforce code quality standards
- **`npm run lint:fix`** – Automatically fix linting issues where possible
- **`npm run build`** – Build the project using tsup (TypeScript bundler)
- **`npm run typecheck`** – Run TypeScript compiler for type checking without emitting files

### Additional Utility Scripts

- **`npm run coverage`** – Generate detailed test coverage reports
- **`npm run format`** – Format code using Prettier
- **`npm run format:check`** – Check code formatting without making changes
- **`npm run ci`** – Run the complete CI pipeline locally (lint + typecheck + test + build)
- **`npm run security`** – Run npm audit to check for security vulnerabilities
- **`npm run deps:check`** – Check for outdated dependencies
- **`npm run deps:unused`** – Find unused dependencies with knip

### Getting Started for Contributors

1. **Clone and install dependencies:**

   ```sh
   git clone https://github.com/magarcia/cross-keychain.git
   cd cross-keychain
   npm install
   ```

2. **Run the development workflow:**

   ```sh
   npm run test:watch  # Start tests in watch mode
   npm run lint        # Check code quality
   npm run typecheck   # Verify TypeScript types
   ```

3. **Before committing:**
   ```sh
   npm run ci  # Run full CI pipeline locally
   ```

The project uses Husky for Git hooks to automatically run linting and tests before commits.

## Contributing

Contributions and bug reports are welcome! Read the [CONTRIBUTING.md](CONTRIBUTING.md) guide and adhere to the [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) when participating. Issues and pull requests live at the [GitHub repository](https://github.com/magarcia/cross-keychain).

## License

Released under the [MIT License](LICENSE).
