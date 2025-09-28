import meow from "meow";
import readline from "readline";
import {
  deletePassword,
  diagnose,
  getCredential,
  getPassword,
  listBackends,
  setPassword,
  useBackend,
  disable,
} from "./index.js";

const cli = meow(
  `\n  Usage\n    $ cross-keychain <operation> <service> [account]\n\n  Operations\n    get       Retrieve a password or credential for a service\n    set       Store a password for a service and account\n    del       Delete a password for a service and account\n    diagnose  Print environment and backend details\n\n  Options\n    --backend <id>       Force a specific backend\n    --mode <mode>        Mode for 'get' (password|creds, default: password)\n    --output <format>    Output format for 'get' (plain|json, default: plain)\n    --password-stdin     Read password from stdin for 'set'\n    --list-backends      List all detected backends\n    --disable            Persistently configure the null backend\n\n  Examples\n    $ cross-keychain set github myusername\n    $ cross-keychain get github myusername\n    $ cross-keychain del github myusername\n    $ cross-keychain --list-backends\n`,
  {
    importMeta: import.meta,
    flags: {
      backend: {
        type: "string",
      },
      mode: {
        type: "string",
        default: "password",
        choices: ["password", "creds"],
      },
      output: {
        type: "string",
        default: "plain",
        choices: ["plain", "json"],
      },
      passwordStdin: {
        type: "boolean",
        default: false,
      },
      listBackends: {
        type: "boolean",
        default: false,
      },
      disable: {
        type: "boolean",
        default: false,
      },
    },
  },
);

/**
 * Main entry point for the CLI application.
 * Parses command-line arguments and dispatches to the appropriate handler.
 * Handles backend selection, operation routing, and error handling.
 */
export async function main(): Promise<void> {
  if (cli.flags.listBackends) {
    await showBackends();
    return;
  }

  if (cli.flags.disable) {
    await disable();
    console.log("Null backend configured");
    return;
  }

  if (cli.flags.backend) {
    await useBackend(cli.flags.backend);
  }

  const [operation, service, username] = cli.input;
  if (!operation) {
    cli.showHelp(1);
  }

  switch (operation) {
    case "get":
      await handleGet(service, username);
      break;
    case "set":
      await handleSet(service, username);
      break;
    case "del":
    case "delete":
      await handleDelete(service, username);
      break;
    case "diagnose":
      await handleDiagnose();
      break;
    default:
      console.error(`Unknown operation: ${operation}`);
      cli.showHelp(1);
  }
}

/**
 * Displays all available keyring backends with their IDs, priorities, and names.
 * Used by the --list-backends flag to show detected backends to the user.
 */
async function showBackends(): Promise<void> {
  const backends = await listBackends();
  for (const backend of backends) {
    console.log(
      `${backend.id}\t(priority: ${backend.priority})\t${backend.name}`,
    );
  }
}

/**
 * Handles the 'get' operation to retrieve passwords or credentials from the keyring.
 *
 * @param service - The service name to retrieve the password/credential for
 * @param username - The username (required for password mode, optional for creds mode)
 * @throws {Error} When required parameters are missing
 */
async function handleGet(service?: string, username?: string): Promise<void> {
  if (!service) {
    throw new Error("'get' requires a service name");
  }
  const mode = cli.flags.mode as "password" | "creds";
  const output = cli.flags.output as "plain" | "json";

  if (mode === "password") {
    if (!username) {
      throw new Error("'get' in password mode requires a username");
    }
    const password = await getPassword(service, username);
    if (password === null) {
      console.error(
        `Password not found for service '${service}' and user '${username}'.`,
      );
      process.exitCode = 1;
      return;
    }
    emitCredential({ username, password }, output, false);
    return;
  }

  const credential = await getCredential(service, username ?? null);
  if (!credential) {
    const msg = username
      ? `Credential not found for service '${service}' and user '${username}'.`
      : `No credentials found for service '${service}'.`;
    console.error(msg);
    process.exitCode = 1;
    return;
  }
  emitCredential(credential, output, mode === "creds");
}

/**
 * Handles the 'set' operation to store a password in the keyring.
 *
 * @param service - The service name to store the password under
 * @param username - The username to associate with the password
 * @throws {Error} When service or username parameters are missing
 */
async function handleSet(service?: string, username?: string): Promise<void> {
  if (!service || !username) {
    throw new Error("'set' requires a service and username");
  }
  const password = cli.flags.passwordStdin
    ? await readSecret("")
    : await readSecret(`Password for '${username}' in '${service}': `);
  await setPassword(service, username, password);
  console.log("Password stored");
}

/**
 * Handles the 'del' operation to delete a password from the keyring.
 *
 * @param service - The service name of the password to delete
 * @param username - The username of the password to delete
 * @throws {Error} When service or username parameters are missing
 */
async function handleDelete(
  service?: string,
  username?: string,
): Promise<void> {
  if (!service || !username) {
    throw new Error("'del' requires a service and username");
  }
  await deletePassword(service, username);
  console.log("Password deleted");
}

/**
 * Handles the 'diagnose' operation to output keyring diagnostic information.
 * Outputs diagnostic information as formatted JSON to the console.
 */
async function handleDiagnose(): Promise<void> {
  const report = await diagnose();
  console.log(JSON.stringify(report, null, 2));
}

function emitCredential(
  credential: { username: string; password: string },
  format: "plain" | "json",
  includeUsername: boolean,
): void {
  if (format === "json") {
    console.log(JSON.stringify(credential));
    return;
  }
  if (includeUsername) {
    console.log(credential.username);
  }
  console.log(credential.password);
}

async function readSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks)
      .toString("utf8")
      .replace(/[\r\n]+$/, "");
  }
  return await promptHidden(prompt);
}

async function promptHidden(prompt: string): Promise<string> {
  return await new Promise<string>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const wasRaw = process.stdin.isTTY ? process.stdin.isRaw : undefined;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    let value = "";

    const onData = (char: Buffer): void => {
      const [code] = char;
      if (code === 3) {
        process.stdout.write("\n");
        cleanup();
        process.exit(1);
      }
      if (code === 13 || code === 10) {
        process.stdout.write("\n");
        cleanup();
        resolve(value);
        return;
      }
      if (code === 127 || code === 8) {
        value = value.slice(0, -1);
      } else {
        value += char.toString();
      }
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(prompt + "*".repeat(value.length));
    };

    const cleanup = (): void => {
      process.stdin.off("data", onData);
      rl.close();
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(Boolean(wasRaw));
      }
    };

    process.stdout.write(prompt);
    process.stdin.on("data", onData);
  });
}

export const __testing = {
  showBackends,
  handleGet,
  handleSet,
  handleDelete,
  handleDiagnose,
  emitCredential,
  readSecret,
  promptHidden,
};

if (!process.env.VITEST_WORKER_ID) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
