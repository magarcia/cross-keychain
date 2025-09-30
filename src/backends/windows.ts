import {
  KeyringError,
  PasswordSetError,
  PasswordDeleteError,
} from "../errors.js";
import { ConfigurableBackend } from "../base-backend.js";
import { runtime, getCredmanBootstrap } from "../runtime.js";

/**
 * Backend for Windows Credential Manager using PowerShell and Windows API.
 * Stores credentials in the Windows Credential Vault as generic credentials.
 * Uses PowerShell with P/Invoke to access the native Windows Credential Manager API.
 */
export class WindowsCredentialBackend extends ConfigurableBackend {
  public readonly id = "windows";
  public readonly name = "Windows Credential Manager";
  public readonly priority = 5;

  /**
   * Checks if this backend is supported on the current platform.
   * Requires Windows and functional PowerShell.
   *
   * @returns True if Windows and PowerShell are available
   */
  public static async isSupported(): Promise<boolean> {
    if (process.platform !== "win32") {
      return false;
    }
    try {
      await runtime.runPowerShell("Write-Output 'ok'");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves a password from Windows Credential Manager.
   * Uses PowerShell to call CredRead from the Windows API.
   *
   * @param service - The service identifier
   * @param account - The account identifier
   * @returns The stored password, or null if not found
   */
  public async getPassword(
    service: string,
    account: string,
  ): Promise<string | null> {
    this.validateIdentifier(account, "account");
    const target = this.buildTarget(service, account);
    const targetB64 = Buffer.from(target, "utf8").toString("base64");
    const bootstrap = await getCredmanBootstrap();
    const script = `${bootstrap}
$target = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${targetB64}'))
$ptr = [IntPtr]::Zero
if (-not [CredMan.CredentialManager]::CredRead($target, 1, 0, [ref]$ptr)) {
  exit 2
}
try {
  $cred = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [Type]'CredMan.CredentialManager+CREDENTIAL')
  if ($cred.CredentialBlob -eq [IntPtr]::Zero -or $cred.CredentialBlobSize -le 0) {
    Write-Output ''
  } else {
    Write-Output ([Runtime.InteropServices.Marshal]::PtrToStringUni($cred.CredentialBlob, [int]($cred.CredentialBlobSize / 2)))
  }
} finally {
  [CredMan.CredentialManager]::CredFree($ptr)
}`;
    const result = await runtime.runPowerShell(script, { timeoutMs: 10000 });
    if (result.code === 2) {
      return null;
    }
    if (result.code !== 0) {
      throw new KeyringError(
        `Credential Manager operation failed with code ${result.code}`,
      );
    }
    return result.stdout.replace(/\r?\n$/, "");
  }

  /**
   * Stores a password in Windows Credential Manager.
   * Uses PowerShell to call CredWrite from the Windows API.
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
    this.validateIdentifier(account, "account");
    this.validatePassword(password);
    const target = this.buildTarget(service, account);
    const persistValue = this.persistence;
    this.validatePersistence(persistValue);
    const targetB64 = Buffer.from(target, "utf8").toString("base64");
    const accountB64 = Buffer.from(account, "utf8").toString("base64");
    const passwordB64 = Buffer.from(password, "utf8").toString("base64");
    const bootstrap = await getCredmanBootstrap();
    const script = `${bootstrap}
$target = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${targetB64}'))
$username = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${accountB64}'))
$password = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${passwordB64}'))
$persist = ${persistValue}
$bytes = [System.Text.Encoding]::Unicode.GetBytes($password)
$cred = New-Object CredMan.CredentialManager+CREDENTIAL
$cred.Type = 1
$cred.TargetName = $target
$cred.UserName = $username
$cred.CredentialBlobSize = $bytes.Length
$cred.Persist = $persist
$cred.CredentialBlob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
try {
  [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $cred.CredentialBlob, $bytes.Length)
  if (-not [CredMan.CredentialManager]::CredWrite([ref]$cred, 0)) {
    $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "CredWrite failed: $code"
  }
} finally {
  if ($cred.CredentialBlob -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::FreeHGlobal($cred.CredentialBlob)
  }
}`;
    const result = await runtime.runPowerShell(script, { timeoutMs: 10000 });
    if (result.code !== 0) {
      throw new PasswordSetError(
        `Credential Manager operation failed with code ${result.code}`,
      );
    }
  }

  /**
   * Deletes a password from Windows Credential Manager.
   * Uses PowerShell to call CredDelete from the Windows API.
   *
   * @param service - The service identifier
   * @param account - The account identifier
   * @throws {PasswordDeleteError} If the password does not exist
   */
  public async deletePassword(service: string, account: string): Promise<void> {
    this.validateIdentifier(account, "account");
    const target = this.buildTarget(service, account);
    const targetB64 = Buffer.from(target, "utf8").toString("base64");
    const bootstrap = await getCredmanBootstrap();
    const script = `${bootstrap}
$target = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${targetB64}'))
if (-not [CredMan.CredentialManager]::CredDelete($target, 1, 0)) {
  $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  if ($code -eq 1168) {
    exit 2
  }
  throw "CredDelete failed: $code"
}`;
    const result = await runtime.runPowerShell(script, { timeoutMs: 10000 });
    if (result.code === 2) {
      throw new PasswordDeleteError("Password not found");
    }
    if (result.code !== 0) {
      throw new PasswordDeleteError(
        `Credential Manager operation failed with code ${result.code}`,
      );
    }
  }

  private buildTarget(service: string, account: string): string {
    this.validateIdentifier(service, "service");
    return `${service}:${account}`;
  }

  /**
   *
   */
  public override async diagnose(): Promise<Record<string, unknown>> {
    const details = await super.diagnose();
    return {
      ...details,
      persistence: this.persistence,
    };
  }

  private get persistence(): number {
    const value = this.properties["persist"];
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.floor(value);
    }
    if (typeof value === "string" && value.length) {
      const normalized = value.toLowerCase();
      if (["session", "cred_persist_session"].includes(normalized)) {
        return 1;
      }
      if (
        [
          "local",
          "local_machine",
          "localmachine",
          "cred_persist_local_machine",
        ].includes(normalized)
      ) {
        return 2;
      }
      if (["enterprise", "cred_persist_enterprise"].includes(normalized)) {
        return 3;
      }
    }
    return 3;
  }

  private validatePersistence(value: number): void {
    if (value < 1 || value > 3) {
      throw new KeyringError(
        "Persistence must be 1 (Session), 2 (LocalMachine), or 3 (Enterprise)",
      );
    }
  }
}
