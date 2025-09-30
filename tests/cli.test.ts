import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Readable } from "node:stream";

type CliFlags = {
  backend?: string;
  mode: "password" | "creds";
  output: "plain" | "json";
  listBackends: boolean;
  disable: boolean;
};

type CliObject = {
  flags: CliFlags;
  input: string[];
  showHelp: (code?: number) => void;
};

const meowMock = vi.fn<[], CliObject>();
const disableMock = vi.fn(async () => {});
const deletePasswordMock = vi.fn(async () => {});
const getCredentialMock = vi.fn(async () => null);
const getPasswordMock = vi.fn(async () => null);
const listBackendsMock = vi.fn(
  async () =>
    [] as Array<{
      id: string;
      name: string;
      priority: number;
    }>,
);
const setPasswordMock = vi.fn(async () => {});
const useBackendMock = vi.fn(async () => {});
const diagnoseMock = vi.fn(async () => ({}));

vi.mock("meow", () => ({
  default: meowMock,
}));

vi.mock("../src/index.js", () => ({
  deletePassword: deletePasswordMock,
  diagnose: diagnoseMock,
  getCredential: getCredentialMock,
  getPassword: getPasswordMock,
  listBackends: listBackendsMock,
  setPassword: setPasswordMock,
  useBackend: useBackendMock,
  disable: disableMock,
}));

function buildCli({
  flags,
  input = [],
}: {
  flags?: Partial<CliFlags>;
  input?: string[];
} = {}): CliObject {
  const cli: CliObject = {
    flags: {
      backend: undefined,
      mode: "password",
      output: "plain",
      listBackends: false,
      disable: false,
      ...(flags ?? {}),
    },
    input,
    showHelp: vi.fn(),
  };
  meowMock.mockReturnValueOnce(cli);
  return cli;
}

async function runCli(): Promise<typeof import("../src/cli.js")> {
  const module = await import("../src/cli.js");
  try {
    await module.main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
  return module;
}

afterEach(() => {
  process.exitCode = undefined;
});

describe("CLI integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("lists detected backends when --list-backends flag is set", async () => {
    buildCli({
      flags: { listBackends: true },
    });
    listBackendsMock.mockResolvedValueOnce([
      { id: "file", name: "File backend", priority: 1 },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCli();

    expect(listBackendsMock).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("file\t(priority: 1)\tFile backend");

    logSpy.mockRestore();
  });

  it("disables the keyring when --disable flag is provided", async () => {
    buildCli({
      flags: { disable: true },
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCli();

    expect(disableMock).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Null backend configured");

    logSpy.mockRestore();
  });

  it("forces backend when --backend flag is used", async () => {
    buildCli({
      flags: { backend: "file" },
      input: ["get", "svc", "user"],
    });
    getPasswordMock.mockResolvedValueOnce("secret");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCli();

    expect(useBackendMock).toHaveBeenCalledWith("file");
    expect(getPasswordMock).toHaveBeenCalledWith("svc", "user");
    expect(logSpy).toHaveBeenLastCalledWith("secret");

    logSpy.mockRestore();
  });

  it("shows help when no operation is provided", async () => {
    const cli = buildCli();

    await runCli();

    expect(cli.showHelp).toHaveBeenCalledWith(1);
  });

  it("reports unknown operations", async () => {
    const cli = buildCli({
      input: ["unknown"],
    });
    const logSpy = vi.spyOn(console, "log");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runCli();

    expect(errorSpy).toHaveBeenCalledWith("Unknown operation: unknown");
    expect(cli.showHelp).toHaveBeenCalledWith(1);

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("requires a service for get", async () => {
    buildCli({
      input: ["get"],
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runCli();

    expect(errorSpy).toHaveBeenCalledWith("'get' requires a service name");
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
  });

  it("requires a username for password mode", async () => {
    buildCli({
      input: ["get", "svc"],
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runCli();

    expect(errorSpy).toHaveBeenCalledWith(
      "'get' in password mode requires a username",
    );
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
  });

  it("exits with error when password is missing", async () => {
    buildCli({
      input: ["get", "svc", "user"],
    });
    getPasswordMock.mockResolvedValueOnce(null);

    await runCli();

    expect(process.exitCode).toBe(1);
  });

  it("prints retrieved password", async () => {
    buildCli({
      input: ["get", "svc", "user"],
    });
    getPasswordMock.mockResolvedValueOnce("secret");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCli();

    expect(logSpy).toHaveBeenLastCalledWith("secret");

    logSpy.mockRestore();
  });

  it("prints credentials in plain mode including username", async () => {
    buildCli({
      flags: { mode: "creds", output: "plain" },
      input: ["get", "svc"],
    });
    getCredentialMock.mockResolvedValueOnce({
      username: "user",
      password: "pw",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCli();

    expect(logSpy).toHaveBeenNthCalledWith(1, "user");
    expect(logSpy).toHaveBeenNthCalledWith(2, "pw");

    logSpy.mockRestore();
  });

  it("prints credentials as JSON when requested", async () => {
    buildCli({
      flags: { mode: "creds", output: "json" },
      input: ["get", "svc"],
    });
    getCredentialMock.mockResolvedValueOnce({
      username: "user",
      password: "pw",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCli();

    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({ username: "user", password: "pw" }),
    );

    logSpy.mockRestore();
  });

  it("sets exit code when credential lookup fails", async () => {
    buildCli({
      flags: { mode: "creds" },
      input: ["get", "svc"],
    });
    getCredentialMock.mockResolvedValueOnce(null);

    await runCli();

    expect(process.exitCode).toBe(1);
  });

  it("stores passwords provided via stdin when not a TTY", async () => {
    const stdinDescriptor = Object.getOwnPropertyDescriptor(process, "stdin")!;
    const input = Readable.from(["super-secret\n"]);
    (input as NodeJS.ReadStream).isTTY = false;
    Object.defineProperty(process, "stdin", {
      configurable: true,
      value: input,
    });

    buildCli({
      input: ["set", "svc", "user"],
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await runCli();
    } finally {
      Object.defineProperty(process, "stdin", stdinDescriptor);
    }

    expect(setPasswordMock).toHaveBeenCalledWith("svc", "user", "super-secret");
    expect(logSpy).toHaveBeenCalledWith("Password stored");

    logSpy.mockRestore();
  });

  it("deletes passwords", async () => {
    buildCli({
      input: ["del", "svc", "user"],
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCli();

    expect(deletePasswordMock).toHaveBeenCalledWith("svc", "user");
    expect(logSpy).toHaveBeenCalledWith("Password deleted");

    logSpy.mockRestore();
  });

  it("diagnoses the active backend", async () => {
    buildCli({
      input: ["diagnose"],
    });
    diagnoseMock.mockResolvedValueOnce({ backend: "test" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCli();

    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({ backend: "test" }, null, 2),
    );

    logSpy.mockRestore();
  });

  it("requires both service and username for set", async () => {
    buildCli({
      input: ["set", "svc"],
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runCli();

    expect(errorSpy).toHaveBeenCalledWith(
      "'set' requires a service and username",
    );
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
  });

  it("requires both service and username for delete", async () => {
    buildCli({
      input: ["del", "svc"],
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runCli();

    expect(errorSpy).toHaveBeenCalledWith(
      "'del' requires a service and username",
    );
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
  });
});

describe("promptHidden", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls the inquirer password prompt with correct message", async () => {
    vi.doMock("@inquirer/prompts", () => ({
      password: vi.fn().mockResolvedValue("test-password"),
    }));

    const { __testing } = await import("../src/cli.js");
    const { password } = await import("@inquirer/prompts");

    const result = await __testing.promptHidden("Enter password: ");

    expect(result).toBe("test-password");
    expect(password).toHaveBeenCalledWith({ message: "Enter password: " });
  });

  it("readSecret calls promptHidden when stdin is a TTY", async () => {
    const stdinDescriptor = Object.getOwnPropertyDescriptor(process, "stdin")!;
    const stdin = {
      isTTY: true,
    } as NodeJS.ReadStream;

    Object.defineProperty(process, "stdin", {
      configurable: true,
      value: stdin,
    });

    try {
      vi.doMock("@inquirer/prompts", () => ({
        password: vi.fn().mockResolvedValue("tty-password"),
      }));

      const { __testing } = await import("../src/cli.js");

      const result = await __testing.readSecret("Password: ");

      expect(result).toBe("tty-password");
    } finally {
      Object.defineProperty(process, "stdin", stdinDescriptor);
    }
  });
});

describe("module bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("logs errors via top-level handler when auto-run fails", async () => {
    const originalWorkerId = process.env.VITEST_WORKER_ID;
    delete process.env.VITEST_WORKER_ID;

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    buildCli({ input: ["set"] });

    try {
      await import("../src/cli.js");
      await new Promise((resolve) => setImmediate(resolve));
      expect(errorSpy).toHaveBeenCalledWith(
        "'set' requires a service and username",
      );
      expect(process.exitCode).toBe(1);
    } finally {
      process.env.VITEST_WORKER_ID = originalWorkerId;
      errorSpy.mockRestore();
      process.exitCode = undefined;
    }
  });
});
