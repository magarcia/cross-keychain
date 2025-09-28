import os from "os";
import path from "path";
import { promises as fs } from "fs";
import type { KeyringConfig } from "./types.js";

/**
 *
 */
export function getConfigFile(): string {
  return path.join(getConfigRoot(), "keyring.config.json");
}

/**
 *
 */
export function getConfigRoot(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "keyring");
  }

  if (process.platform === "win32") {
    const root =
      process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir();
    return path.join(root, "Keyring");
  }
  const fallback = path.join(os.homedir(), ".config");
  return path.join(fallback, "keyring");
}

/**
 *
 */
export function getDataRoot(): string {
  if (process.env.XDG_DATA_HOME) {
    return path.join(process.env.XDG_DATA_HOME, "keyring");
  }

  if (process.platform === "win32") {
    const root =
      process.env.LOCALAPPDATA || process.env.ProgramData || os.homedir();
    return path.join(root, "Keyring");
  }
  const fallback = path.join(os.homedir(), ".local", "share");
  return path.join(fallback, "keyring");
}

/**
 *
 */
export async function ensureParent(file: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
}

/**
 *
 */
export async function readConfig(): Promise<KeyringConfig> {
  const file = getConfigFile();
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as KeyringConfig;
}
