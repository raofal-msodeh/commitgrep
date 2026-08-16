#!/usr/bin/env node
/** CommitGrep CLI entry point. */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { CommitGrepError } from "./commitgrep/errors.js";
import { formatText, search, validatePaths } from "./commitgrep/engine.js";
import type { Report, SearchOptions } from "./commitgrep/models.js";
import { EXIT_ERROR, EXIT_NO_MATCHES, EXIT_OK } from "./commitgrep/models.js";

interface CliArgs {
  root: string;
  messagePattern?: string;
  caseSensitive?: boolean;
  diffTerm?: string;
  since?: string;
  until?: string;
  authorPattern?: string;
  paths?: string[];
  format: "text" | "json" | "count";
  reportPath?: string;
  limit?: number;
}

function printUsage(): void {
  process.stdout.write(`Usage: commitgrep <repo-root> [options]

Options:
  -m, --message <regex>   Search commit messages (case-insensitive by default)
  -C, --case-sensitive    Make message matching case-sensitive
  -d, --diff <term>       Pickaxe-style diff content search
  -a, --author <regex>    Filter by author name or email
  -f, --file <path>       Only commits touching this repo-relative path (repeatable)
  -s, --since <iso8601>   Start of time window
  -u, --until <iso8601>   End of time window
  --limit <n>             Cap commits walked (default 10000, max 100000)
  --format <text|json|count>  Output format (default text)
  -r, --report <path>     Absolute path for a JSON report file

Exit codes: 0 matches found, 1 no matches, 2 input/usage error
`);
}

function parseCli(argv: string[]): CliArgs | null {
  const args: CliArgs = { root: "", format: "text" };
  const files: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const token = argv[i];
    switch (token) {
      case "-h":
      case "--help":
        printUsage();
        return null;
      case "-m":
      case "--message":
        args.messagePattern = argv[++i];
        break;
      case "-C":
      case "--case-sensitive":
        args.caseSensitive = true;
        break;
      case "-d":
      case "--diff":
        args.diffTerm = argv[++i];
        break;
      case "-a":
      case "--author":
        args.authorPattern = argv[++i];
        break;
      case "-f":
      case "--file":
        files.push(argv[++i]);
        break;
      case "-s":
      case "--since":
        args.since = argv[++i];
        break;
      case "-u":
      case "--until":
        args.until = argv[++i];
        break;
      case "--limit":
        args.limit = Number(argv[++i]);
        break;
      case "--format": {
        const fmt = argv[++i];
        if (fmt !== "text" && fmt !== "json" && fmt !== "count") {
          throw new CommitGrepError(`unknown format: ${fmt}`);
        }
        args.format = fmt;
        break;
      }
      case "-r":
      case "--report":
        args.reportPath = argv[++i];
        break;
      default:
        if (token.startsWith("-")) {
          throw new CommitGrepError(`unknown option: ${token}`);
        }
        if (args.root === "") {
          args.root = token;
        } else {
          throw new CommitGrepError(`unexpected argument: ${token}`);
        }
    }
    i += 1;
  }
  if (files.length > 0) args.paths = files;
  return args;
}

function emitReport(report: Report, format: "text" | "json" | "count"): string {
  if (format === "json") return JSON.stringify(report, null, 2) + "\n";
  if (format === "count") return `${report.matchCount}\n`;
  return formatText(report);
}

export async function run(argv: string[]): Promise<number> {
  const args = parseCli(argv);
  if (args === null) return EXIT_OK;
  if (args.root === "") {
    printUsage();
    return EXIT_ERROR;
  }
  if (!path.isAbsolute(args.root)) {
    process.stderr.write("error: repository root must be an absolute path\n");
    return EXIT_ERROR;
  }
  if (args.paths !== undefined) {
    // Validate early (validatePaths needs the resolved root; we re-resolve after search).
    // Here we only reject obviously invalid shapes; full boundary check runs in search().
    for (const file of args.paths) {
      if (file === "" || file.startsWith("/") || file.includes("\0")) {
        process.stderr.write(`error: invalid file filter: ${file}\n`);
        return EXIT_ERROR;
      }
    }
  }
  if (args.reportPath !== undefined && !path.isAbsolute(args.reportPath)) {
    process.stderr.write("error: report path must be absolute\n");
    return EXIT_ERROR;
  }
  if (args.limit !== undefined && (Number.isNaN(args.limit) || args.limit <= 0)) {
    process.stderr.write("error: limit must be a positive integer\n");
    return EXIT_ERROR;
  }

  const options: SearchOptions = {
    root: args.root,
    messagePattern: args.messagePattern,
    caseSensitive: args.caseSensitive,
    diffTerm: args.diffTerm,
    since: args.since,
    until: args.until,
    authorPattern: args.authorPattern,
    paths: args.paths,
    limit: args.limit,
  };

  try {
    const report = await search(options);
    process.stdout.write(emitReport(report, args.format));
    if (args.reportPath !== undefined) {
      fs.writeFileSync(args.reportPath, JSON.stringify(report, null, 2) + "\n", "utf-8");
      process.stdout.write(`report: ${args.reportPath}\n`);
    }
    return report.matchCount > 0 ? EXIT_OK : EXIT_NO_MATCHES;
  } catch (error) {
    if (error instanceof CommitGrepError) {
      process.stderr.write(`error: ${error.message}\n`);
    } else {
      process.stderr.write("error: unexpected failure\n");
    }
    return EXIT_ERROR;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void run(process.argv.slice(2)).then((code) => process.exit(code));
}

export type { CliArgs };
export { validatePaths as _validatePaths };
