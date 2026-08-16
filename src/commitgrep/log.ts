/** Git log parsing and validation for CommitGrep. */

import { spawnSync } from "node:child_process";
import path from "node:path";

import { BinaryContentError, InvalidDateError, NotARepositoryError } from "./errors.js";
import type { Commit } from "./models.js";

const FIELD_SEPARATOR = "===cg===";
const RECORD_SEPARATOR = "===rec===";

/**
 * Verify that `root` is the root of a git working tree and return its absolute
 * path. Throws NotARepositoryError otherwise.
 */
export function resolveRepository(root: string): string {
  const absolute = path.resolve(root);
  const probe = spawnSync("git", ["-C", absolute, "rev-parse", "--is-inside-work-tree"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (probe.status !== 0 || probe.stdout.trim() !== "true") {
    throw new NotARepositoryError(root);
  }
  const rootProbe = spawnSync("git", ["-C", absolute, "rev-parse", "--show-toplevel"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (rootProbe.status !== 0) {
    throw new NotARepositoryError(root);
  }
  return rootProbe.stdout.trim();
}

/** Throw if `dateish` is not a parseable ISO 8601 timestamp. */
export function assertIsoDate(dateish: string): void {
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})?)?$/.test(dateish)) {
    throw new InvalidDateError(dateish);
  }
  if (Number.isNaN(Date.parse(dateish))) {
    throw new InvalidDateError(dateish);
  }
}

/**
 * Run `git log` for metadata only (message, author, date). Stats are computed
 * per commit with `git diff-tree --numstat` when needed.
 */
export function walkLog(
  repoRoot: string,
  limit: number,
  since?: string,
  until?: string,
  paths?: string[],
  authorPattern?: string,
  messagePattern?: string,
  caseSensitive?: boolean,
): string {
  const args = [
    "-C",
    repoRoot,
    "log",
    `--format=%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%ae${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%b${RECORD_SEPARATOR}`,
    `--max-count=${limit}`,
    "--reverse",
  ];
  if (since !== undefined) args.push(`--after=${since}`);
  if (until !== undefined) args.push(`--before=${until}`);
  if (authorPattern !== undefined) args.push(`--author=${authorPattern}`);
  if (messagePattern !== undefined) {
    args.push(`--grep=${messagePattern}`);
    if (!caseSensitive) args.push("-i");
  }
  if (paths !== undefined && paths.length > 0) args.push("--", ...paths);
  const result = spawnSync("git", args, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error !== undefined) {
    throw new BinaryContentError(`git invocation failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    if (result.stderr.includes("does not have any commits yet")) {
      return "";
    }
    throw new BinaryContentError(`git log failed: ${result.stderr.trim() || "unknown error"}`);
  }
  return result.stdout;
}

/** Compute insertions/deletions for one commit via diff-tree numstat. */
export function diffStats(repoRoot: string, hash: string): { insertions: number; deletions: number; filesChanged: number } {
  const result = spawnSync(
    "git",
    ["-C", repoRoot, "diff-tree", "--root", "--numstat", "-r", hash],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    throw new BinaryContentError(`git diff-tree failed for ${hash}`);
  }
  let insertions = 0;
  let deletions = 0;
  let filesChanged = 0;
  for (const line of result.stdout.split("\n")) {
    const parts = line.split("\t");
    if (parts.length === 3 && /^\d+$/.test(parts[0])) {
      filesChanged += 1;
      insertions += Number(parts[1]);
      deletions += Number(parts[2]);
    }
  }
  return { insertions, deletions, filesChanged };
}

/**
 * Parse the raw log output into Commit records. Throws BinaryContentError
 * when a record is malformed (e.g. binary content broke the encoding).
 */
export function parseLog(output: string, repoRoot?: string): Commit[] {
  if (output.trim() === "") {
    return [];
  }
  const commits: Commit[] = [];
  for (const record of output.split(RECORD_SEPARATOR)) {
    const trimmed = record.trim();
    if (trimmed === "") continue;
    const fields = trimmed.split(FIELD_SEPARATOR);
    if (fields.length < 7) {
      throw new BinaryContentError(`malformed log record (${fields.length} fields)`);
    }
    const hash = fields[0];
    if (hash === "") {
      throw new BinaryContentError("log record missing hash");
    }
    const subject = fields[5];
    const body = fields.slice(6).join(FIELD_SEPARATOR);
    const { insertions, deletions, filesChanged } =
      repoRoot !== undefined
        ? diffStats(repoRoot, hash)
        : { insertions: 0, deletions: 0, filesChanged: 0 };
    commits.push({
      hash,
      shortHash: fields[1],
      authorName: fields[2],
      authorEmail: fields[3],
      authorDate: fields[4],
      message: `${subject}\n${body}`.trim(),
      filesChanged,
      insertions,
      deletions,
    });
  }
  return commits;
}
