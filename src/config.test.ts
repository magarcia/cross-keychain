import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import {
  getConfigFile,
  getConfigRoot,
  getDataRoot,
  readConfig,
  ensureParent,
} from "./config.js";
import type { KeyringConfig } from "./types.js";

describe("Config utilities", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalPlatform: PropertyDescriptor;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.XDG_DATA_HOME;
    delete process.env.LOCALAPPDATA;
    delete process.env.APPDATA;
    delete process.env.ProgramData;
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process, "platform", originalPlatform);
    vi.restoreAllMocks();
  });

  describe("getConfigRoot", () => {
    it("uses XDG_CONFIG_HOME when set", () => {
      process.env.XDG_CONFIG_HOME = "/custom/config";
      const result = getConfigRoot();
      expect(result).toBe(path.join("/custom/config", "keyring"));
    });

    it("falls back to ~/.config on Unix-like systems", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "linux",
      });
      const homedir = os.homedir();
      const result = getConfigRoot();
      expect(result).toBe(path.join(homedir, ".config", "keyring"));
    });

    it("uses LOCALAPPDATA on Windows", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";
      const result = getConfigRoot();
      expect(result).toBe(
        path.join("C:\\Users\\Test\\AppData\\Local", "Keyring"),
      );
    });

    it("falls back to APPDATA on Windows when LOCALAPPDATA not set", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      process.env.APPDATA = "C:\\Users\\Test\\AppData\\Roaming";
      const result = getConfigRoot();
      expect(result).toBe(
        path.join("C:\\Users\\Test\\AppData\\Roaming", "Keyring"),
      );
    });

    it("falls back to home directory on Windows when no env vars set", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      const homedir = os.homedir();
      const result = getConfigRoot();
      expect(result).toBe(path.join(homedir, "Keyring"));
    });

    it("prefers XDG_CONFIG_HOME over platform-specific paths", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      process.env.XDG_CONFIG_HOME = "/custom/xdg/config";
      process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";
      const result = getConfigRoot();
      expect(result).toBe(path.join("/custom/xdg/config", "keyring"));
    });
  });

  describe("getDataRoot", () => {
    it("uses XDG_DATA_HOME when set", () => {
      process.env.XDG_DATA_HOME = "/custom/data";
      const result = getDataRoot();
      expect(result).toBe(path.join("/custom/data", "keyring"));
    });

    it("falls back to ~/.local/share on Unix-like systems", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "linux",
      });
      const homedir = os.homedir();
      const result = getDataRoot();
      expect(result).toBe(path.join(homedir, ".local", "share", "keyring"));
    });

    it("uses LOCALAPPDATA on Windows", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";
      const result = getDataRoot();
      expect(result).toBe(
        path.join("C:\\Users\\Test\\AppData\\Local", "Keyring"),
      );
    });

    it("falls back to ProgramData on Windows when LOCALAPPDATA not set", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      process.env.ProgramData = "C:\\ProgramData";
      const result = getDataRoot();
      expect(result).toBe(path.join("C:\\ProgramData", "Keyring"));
    });

    it("falls back to home directory on Windows when no env vars set", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      const homedir = os.homedir();
      const result = getDataRoot();
      expect(result).toBe(path.join(homedir, "Keyring"));
    });

    it("prefers XDG_DATA_HOME over platform-specific paths", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      process.env.XDG_DATA_HOME = "/custom/xdg/data";
      process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";
      const result = getDataRoot();
      expect(result).toBe(path.join("/custom/xdg/data", "keyring"));
    });
  });

  describe("getConfigFile", () => {
    it("returns path within config root", () => {
      process.env.XDG_CONFIG_HOME = "/test/config";
      const result = getConfigFile();
      expect(result).toBe(
        path.join("/test/config", "keyring", "keyring.config.json"),
      );
    });

    it("uses platform-specific config root", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";
      const result = getConfigFile();
      expect(result).toBe(
        path.join(
          "C:\\Users\\Test\\AppData\\Local",
          "Keyring",
          "keyring.config.json",
        ),
      );
    });
  });

  describe("ensureParent", () => {
    it("creates parent directory with correct permissions", async () => {
      const mkdirSpy = vi.spyOn(fs, "mkdir").mockResolvedValue(undefined);
      const testPath = "/test/path/to/file.json";

      await ensureParent(testPath);

      expect(mkdirSpy).toHaveBeenCalledWith("/test/path/to", {
        recursive: true,
        mode: 0o700,
      });
    });

    it("handles nested paths correctly", async () => {
      const mkdirSpy = vi.spyOn(fs, "mkdir").mockResolvedValue(undefined);
      const testPath = "/deeply/nested/path/to/file.json";

      await ensureParent(testPath);

      expect(mkdirSpy).toHaveBeenCalledWith("/deeply/nested/path/to", {
        recursive: true,
        mode: 0o700,
      });
    });

    it("propagates mkdir errors", async () => {
      const error = new Error("Permission denied");
      vi.spyOn(fs, "mkdir").mockRejectedValue(error);

      await expect(ensureParent("/test/file.json")).rejects.toBe(error);
    });
  });

  describe("readConfig", () => {
    it("reads and parses valid JSON configuration", async () => {
      const mockConfig: KeyringConfig = {
        defaultBackend: "file",
        backendProperties: {
          file: { file_path: "/tmp/store.json" },
        },
      };
      const readFileSpy = vi
        .spyOn(fs, "readFile")
        .mockResolvedValue(JSON.stringify(mockConfig));

      const result = await readConfig();

      expect(result).toEqual(mockConfig);
      expect(readFileSpy).toHaveBeenCalledWith(
        expect.stringContaining("keyring.config.json"),
        "utf8",
      );
    });

    it("throws when configuration file contains invalid JSON", async () => {
      vi.spyOn(fs, "readFile").mockResolvedValue("{ invalid json");

      await expect(readConfig()).rejects.toThrow();
    });

    it("propagates file read errors", async () => {
      const error = new Error("ENOENT: no such file or directory");
      vi.spyOn(fs, "readFile").mockRejectedValue(error);

      await expect(readConfig()).rejects.toBe(error);
    });

    it("parses configuration with only defaultBackend", async () => {
      const mockConfig: KeyringConfig = {
        defaultBackend: "null",
      };
      vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockConfig));

      const result = await readConfig();

      expect(result).toEqual(mockConfig);
      expect(result.backendProperties).toBeUndefined();
    });

    it("parses configuration with only backendProperties", async () => {
      const mockConfig: KeyringConfig = {
        backendProperties: {
          file: { file_path: "/custom/path.json" },
          windows: { persist: "local" },
        },
      };
      vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockConfig));

      const result = await readConfig();

      expect(result).toEqual(mockConfig);
      expect(result.defaultBackend).toBeUndefined();
    });

    it("parses empty configuration object", async () => {
      const mockConfig: KeyringConfig = {};
      vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockConfig));

      const result = await readConfig();

      expect(result).toEqual({});
    });

    it("uses correct config file path based on XDG_CONFIG_HOME", async () => {
      process.env.XDG_CONFIG_HOME = "/custom/config";
      const mockConfig: KeyringConfig = { defaultBackend: "file" };
      const readFileSpy = vi
        .spyOn(fs, "readFile")
        .mockResolvedValue(JSON.stringify(mockConfig));

      await readConfig();

      expect(readFileSpy).toHaveBeenCalledWith(
        path.join("/custom/config", "keyring", "keyring.config.json"),
        "utf8",
      );
    });

    it("uses correct config file path on Windows", async () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";
      const mockConfig: KeyringConfig = { defaultBackend: "windows" };
      const readFileSpy = vi
        .spyOn(fs, "readFile")
        .mockResolvedValue(JSON.stringify(mockConfig));

      await readConfig();

      expect(readFileSpy).toHaveBeenCalledWith(
        path.join(
          "C:\\Users\\Test\\AppData\\Local",
          "Keyring",
          "keyring.config.json",
        ),
        "utf8",
      );
    });
  });

  describe("Cross-platform behavior", () => {
    it("returns different paths for config and data on Unix", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "linux",
      });
      const configRoot = getConfigRoot();
      const dataRoot = getDataRoot();

      expect(configRoot.replace(/\\/g, "/")).toContain(".config");
      expect(dataRoot.replace(/\\/g, "/")).toContain(".local/share");
      expect(configRoot).not.toBe(dataRoot);
    });

    it("returns same root for config and data on Windows", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";

      const configRoot = getConfigRoot();
      const dataRoot = getDataRoot();

      expect(configRoot).toBe(
        path.join("C:\\Users\\Test\\AppData\\Local", "Keyring"),
      );
      expect(dataRoot).toBe(
        path.join("C:\\Users\\Test\\AppData\\Local", "Keyring"),
      );
      expect(configRoot).toBe(dataRoot);
    });

    it("handles XDG variables consistently across platforms", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      process.env.XDG_CONFIG_HOME = "/xdg/config";
      process.env.XDG_DATA_HOME = "/xdg/data";
      process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";

      const configRoot = getConfigRoot();
      const dataRoot = getDataRoot();

      expect(configRoot).toBe(path.join("/xdg/config", "keyring"));
      expect(dataRoot).toBe(path.join("/xdg/data", "keyring"));
    });
  });

  describe("Path normalization", () => {
    it("normalizes paths with trailing slashes in XDG_CONFIG_HOME", () => {
      process.env.XDG_CONFIG_HOME = "/custom/config/";
      const result = getConfigRoot();
      expect(result).toBe(path.join("/custom/config/", "keyring"));
    });

    it("normalizes paths with trailing slashes in XDG_DATA_HOME", () => {
      process.env.XDG_DATA_HOME = "/custom/data/";
      const result = getDataRoot();
      expect(result).toBe(path.join("/custom/data/", "keyring"));
    });

    it("handles Windows paths with backslashes", () => {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local\\";

      const configRoot = getConfigRoot();
      const dataRoot = getDataRoot();

      expect(configRoot).toContain("Keyring");
      expect(dataRoot).toContain("Keyring");
    });
  });
});
