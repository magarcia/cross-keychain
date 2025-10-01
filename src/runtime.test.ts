import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { promises as fsPromises, constants as fsConstants } from "node:fs";
import type { ChildProcess } from "node:child_process";

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

describe("runtime helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    spawnMock.mockReset();
  });

  const originalPath = process.env.PATH;
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
    process,
    "platform",
  )!;

  afterEach(() => {
    process.env.PATH = originalPath;
    process.env.PATHEXT = undefined;
    Object.defineProperty(process, "platform", originalPlatformDescriptor);
  });

  it("collects command output and forwards stdin", async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      stdin: { end: ReturnType<typeof vi.fn> };
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end: vi.fn() };
    spawnMock.mockReturnValue(child as unknown as ChildProcess);

    const { __testing } = await import("./runtime.js");

    const promise = __testing.runCommand("echo", ["hello"], {
      input: "payload",
      cwd: "/tmp",
    });

    child.stdout.emit("data", Buffer.from("out"));
    child.stderr.emit("data", Buffer.from("err"));
    child.emit("close", 0);

    const result = await promise;

    expect(spawnMock).toHaveBeenCalledWith("echo", ["hello"], {
      stdio: "pipe",
      env: process.env,
      cwd: "/tmp",
    });
    expect(child.stdin.end).toHaveBeenCalledWith("payload");
    expect(result).toEqual({ code: 0, stdout: "out", stderr: "err" });
  });

  it("rejects when the spawned process errors", async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      stdin: { end: ReturnType<typeof vi.fn> };
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end: vi.fn() };
    spawnMock.mockReturnValue(child as unknown as ChildProcess);

    const { __testing } = await import("./runtime.js");

    const promise = __testing.runCommand("boom", []);
    const error = new Error("spawn failed");
    child.emit("error", error);

    await expect(promise).rejects.toBe(error);
  });

  it("kills the process and rejects on timeout", async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      stdin: { end: ReturnType<typeof vi.fn> };
      kill: ReturnType<typeof vi.fn>;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end: vi.fn() };
    child.kill = vi.fn();
    spawnMock.mockReturnValue(child as unknown as ChildProcess);

    const { __testing } = await import("./runtime.js");

    const promise = __testing.runCommand("slow-command", [], {
      timeoutMs: 100,
    });

    // Catch the promise immediately to avoid unhandled rejection warnings
    const expectPromise = expect(promise).rejects.toThrow(
      "Command timed out after 100ms: slow-command",
    );

    // Wait for timeout to trigger
    await new Promise((resolve) => setTimeout(resolve, 150));

    await expectPromise;
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });

  it("returns false when PATH is empty", async () => {
    process.env.PATH = "";
    const { __testing } = await import("./runtime.js");
    expect(await __testing.executableExists("foo")).toBe(false);
  });

  it.skipIf(process.platform === "win32")(
    "detects executables on POSIX systems",
    async () => {
      process.env.PATH = "/usr/bin";
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "linux",
      });
      // Reset modules to ensure fresh import with new platform value
      vi.resetModules();
      const accessSpy = vi
        .spyOn(fsPromises, "access")
        .mockImplementation(async (candidate, mode) => {
          if (candidate === "/usr/bin/tool" && mode === fsConstants.X_OK) {
            return;
          }
          const error = new Error("not found") as NodeJS.ErrnoException;
          error.code = "ENOENT";
          throw error;
        });

      const { __testing } = await import("./runtime.js");
      const result = await __testing.executableExists("tool");

      expect(result).toBe(true);
      expect(accessSpy).toHaveBeenCalled();

      accessSpy.mockRestore();
    },
  );

  it("returns false when executables are missing", async () => {
    process.env.PATH = "/usr/bin";
    const accessSpy = vi
      .spyOn(fsPromises, "access")
      .mockRejectedValue(
        Object.assign(new Error("missing"), { code: "ENOENT" }),
      );

    const { __testing } = await import("./runtime.js");
    const exists = await __testing.executableExists("absent");

    expect(exists).toBe(false);
    accessSpy.mockRestore();
  });

  it.skipIf(process.platform !== "win32")(
    "falls back to PATHEXT probing on Windows",
    async () => {
      process.env.PATH = "C:\\Tools";
      process.env.PATHEXT = ".EXE;.BAT";
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      // Reset modules to ensure fresh import with new platform value
      vi.resetModules();

      const accessSpy = vi
        .spyOn(fsPromises, "access")
        .mockImplementation(async (_candidate, mode) => {
          if (mode === fsConstants.X_OK) {
            const error = new Error("not executable") as NodeJS.ErrnoException;
            error.code = "EACCES";
            throw error;
          }
          if (mode === fsConstants.F_OK) {
            return;
          }
          const error = new Error("not found") as NodeJS.ErrnoException;
          error.code = "ENOENT";
          throw error;
        });

      const { __testing } = await import("./runtime.js");
      const result = await __testing.executableExists("foo");

      expect(result).toBe(true);
      expect(accessSpy).toHaveBeenCalled();

      accessSpy.mockRestore();
    },
  );

  it("runs PowerShell commands using available shells", async () => {
    const { runtime } = await import("./runtime.js");

    // Store original functions
    const originalExec = runtime.executableExists;
    const originalRun = runtime.runCommand;

    try {
      // Mock at runtime object level
      runtime.executableExists = vi.fn(
        async (command) => command === "powershell",
      );
      runtime.runCommand = vi
        .fn()
        .mockResolvedValue({ code: 0, stdout: "", stderr: "" });

      await runtime.runPowerShell("Write-Output 'hi'");

      expect(runtime.runCommand).toHaveBeenCalledWith(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-Command", "Write-Output 'hi'"],
        undefined,
      );

      // Test pwsh fallback
      runtime.executableExists = vi.fn(async (command) => command === "pwsh");
      await runtime.runPowerShell("Write-Output 'hi'");
      expect(runtime.runCommand).toHaveBeenLastCalledWith(
        "pwsh",
        ["-NoProfile", "-NonInteractive", "-Command", "Write-Output 'hi'"],
        undefined,
      );

      // Test error when neither is available
      runtime.executableExists = vi.fn().mockResolvedValue(false);
      await expect(runtime.runPowerShell("Write-Output 'hi'")).rejects.toThrow(
        "PowerShell is required for Windows credential operations",
      );
    } finally {
      // Restore
      runtime.executableExists = originalExec;
      runtime.runCommand = originalRun;
    }
  });
});
