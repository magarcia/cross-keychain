import path from "path";
import { promises as fs, constants as fsConstants } from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { KeyringError, InitError } from "./errors.js";
import type {
  CommandResult,
  CommandOptions,
  RuntimeFunctions,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runCommandImpl(
  command: string,
  args: string[],
  options: CommandOptions = {},
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "pipe",
      env: options.env ?? process.env,
      cwd: options.cwd,
    });

    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | undefined;

    if (options.timeoutMs && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(
          new KeyringError(
            `Command timed out after ${options.timeoutMs}ms: ${command}`,
          ),
        );
      }, options.timeoutMs);
    }

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        code: code ?? 0,
        stdout,
        stderr,
      });
    });

    if (options.input !== undefined) {
      child.stdin?.end(options.input);
    } else {
      child.stdin?.end();
    }
  });
}

async function executableExistsImpl(command: string): Promise<boolean> {
  const delimiter = process.platform === "win32" ? ";" : ":";
  const paths = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  if (paths.length === 0) {
    return false;
  }
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
      : [""];

  for (const base of paths) {
    for (const ext of extensions) {
      const candidate = path.join(base, command + ext);
      try {
        await fs.access(candidate, fsConstants.X_OK);
        return true;
      } catch {
        if (process.platform === "win32") {
          try {
            await fs.access(candidate, fsConstants.F_OK);
            return true;
          } catch {
            // ignore and continue
          }
        }
      }
    }
  }
  return false;
}

let credmanBootstrap: string | null = null;

/**
 * Loads the Windows Credential Manager PowerShell bootstrap script.
 * The script is cached after first load for performance.
 *
 * @returns The PowerShell script content
 */
async function getCredmanBootstrap(): Promise<string> {
  if (!credmanBootstrap) {
    const scriptPath = path.join(__dirname, "scripts", "credman.ps1");
    credmanBootstrap = await fs.readFile(scriptPath, "utf-8");
  }
  return credmanBootstrap;
}

export { getCredmanBootstrap };

export const runtime: RuntimeFunctions = {
  runCommand: runCommandImpl,
  executableExists: executableExistsImpl,
  async runPowerShell(
    script: string,
    options?: CommandOptions,
  ): Promise<CommandResult> {
    const command = (await runtime.executableExists("powershell"))
      ? "powershell"
      : (await runtime.executableExists("pwsh"))
        ? "pwsh"
        : null;

    if (!command) {
      throw new InitError(
        "PowerShell is required for Windows credential operations",
      );
    }

    return runtime.runCommand(
      command,
      ["-NoProfile", "-NonInteractive", "-Command", script],
      options,
    );
  },
};

const defaultRunPowerShell = runtime.runPowerShell;

/**
 *
 */
export function __resetRuntimeForTests(): void {
  runtime.runCommand = runCommandImpl;
  runtime.executableExists = executableExistsImpl;
  runtime.runPowerShell = defaultRunPowerShell;
}

export const __testing =
  process.env.NODE_ENV === "test"
    ? {
        runCommand: runtime.runCommand,
        executableExists: runtime.executableExists,
        runPowerShell: runtime.runPowerShell,
      }
    : (undefined as never);
