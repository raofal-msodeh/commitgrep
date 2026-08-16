/** Search engine: combines time, author, path, message, and diff filters. */

import { commitTouchesDiff } from "./diff.js";
import { InvalidPatternError, PathTraversalError } from "./errors.js";
import { assertIsoDate, parseLog, resolveRepository, walkLog } from "./log.js";
import type { Match, Report, SearchOptions } from "./models.js";

const DEFAULT_LIMIT = 10_000;
const MAX_LIMIT = 100_000;

function buildPattern(raw: string, caseSensitive: boolean): RegExp {
  const flags = caseSensitive ? "" : "i";
  try {
    return new RegExp(raw, flags);
  } catch (cause) {
    throw new InvalidPatternError(raw, cause);
  }
}

/** Reject path filters that escape the repository boundary. */
export function validatePaths(root: string, paths: string[]): string[] {
  const normalized: string[] = [];
  for (const candidate of paths) {
    if (candidate === "" || candidate.startsWith("/") || candidate.includes("\0") || candidate.startsWith("..")) {
      throw new PathTraversalError(candidate);
    }
    const joined = (root + "/" + candidate).replace(/\/+/g, "/");
    if (!joined.startsWith(root + "/") && joined !== root) {
      throw new PathTraversalError(candidate);
    }
    normalized.push(candidate);
  }
  return normalized;
}

/**
 * Execute a filtered commit search. All heavy lifting happens through the
 * `git` binary (spawned only with controlled arguments).
 */
export async function search(options: SearchOptions): Promise<Report> {
  const root = resolveRepository(options.root);
  if (options.since !== undefined) assertIsoDate(options.since);
  if (options.until !== undefined) assertIsoDate(options.until);
  const paths =
    options.paths !== undefined ? validatePaths(root, options.paths) : undefined;
  if (options.messagePattern !== undefined) {
    buildPattern(options.messagePattern, options.caseSensitive === true);
  }
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const messageRegex =
    options.messagePattern !== undefined
      ? buildPattern(options.messagePattern, options.caseSensitive === true)
      : undefined;
  const authorRegex =
    options.authorPattern !== undefined
      ? buildPattern(options.authorPattern, true)
      : undefined;

  // --grep is not applied at git level when a diff term is requested: diff
  // filtering needs the full walk to evaluate -S per commit.
  const walkMessage = options.diffTerm === undefined ? (options.messagePattern ?? undefined) : undefined;
  const raw = walkLog(root, limit, options.since, options.until, paths, undefined, walkMessage, options.caseSensitive);
  const commits = parseLog(raw, root);

  const matches: Match[] = [];
  for (const commit of commits) {
    const reasons: string[] = [];
    if (messageRegex !== undefined && messageRegex.test(commit.message)) {
      reasons.push("message");
    }
    if (options.diffTerm !== undefined) {
      if (commitTouchesDiff(root, commit.hash, options.diffTerm)) {
        reasons.push("diff");
      }
    }
    if (authorRegex !== undefined && (authorRegex.test(commit.authorName) || authorRegex.test(commit.authorEmail))) {
      reasons.push("author");
    }
    if (reasons.length > 0) {
      matches.push({ commit, reasons });
    }
  }

  return {
    root,
    totalCommitsWalked: commits.length,
    matchCount: matches.length,
    matches,
    filters: {
      messagePattern: options.messagePattern,
      diffTerm: options.diffTerm,
      since: options.since,
      until: options.until,
      authorPattern: options.authorPattern,
      paths,
      limit: options.limit,
    },
  };
}

/** Format a report as plain text lines. */
export function formatText(report: Report): string {
  const lines: string[] = [];
  lines.push(`root: ${report.root}`);
  lines.push(
    `walked ${report.totalCommitsWalked} commits | matched ${report.matchCount}`,
  );
  for (const match of report.matches) {
    lines.push(
      `${match.commit.shortHash} ${match.commit.authorDate.slice(0, 10)} ` +
        `${match.commit.authorName} [${match.reasons.join(",")}] ${match.commit.message.split("\n")[0]}`,
    );
  }
  return lines.join("\n") + (lines.length > 0 ? "\n" : "");
}
