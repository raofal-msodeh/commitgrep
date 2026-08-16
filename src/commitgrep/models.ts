/** Core domain model for CommitGrep. */

/** A single commit record extracted from git log. */
export interface Commit {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  authorDate: string; // ISO 8601, git log %aI
  message: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

/** Filter options accepted by the search engine. */
export interface SearchOptions {
  /** Absolute path to the git repository root. */
  root: string;
  /** Regex pattern applied to the full commit message (case-insensitive by default). */
  messagePattern?: string;
  /** Whether messagePattern matching is case-sensitive. */
  caseSensitive?: boolean;
  /** Pickaxe-style diff content search: term added/removed between parent and commit. */
  diffTerm?: string;
  /** ISO 8601 (date only or datetime) lower bound; commits before are excluded. */
  since?: string;
  /** ISO 8601 upper bound; commits after are excluded. */
  until?: string;
  /** Regex applied to author name or email. */
  authorPattern?: string;
  /** Only commits touching at least one of these repo-relative paths. */
  paths?: string[];
  /** Maximum number of commits to walk (hard limit against unbounded scans). */
  limit?: number;
}

/** One matching commit enriched with the reasons it matched. */
export interface Match {
  commit: Commit;
  /** Non-empty list of reasons, e.g. "message", "diff", "author". */
  reasons: string[];
}

/** Aggregated search report. */
export interface Report {
  root: string;
  totalCommitsWalked: number;
  matchCount: number;
  matches: Match[];
  filters: {
    messagePattern?: string;
    diffTerm?: string;
    since?: string;
    until?: string;
    authorPattern?: string;
    paths?: string[];
    limit?: number;
  };
}

/** Output formats the CLI can emit. */
export type ReportFormat = "text" | "json" | "count";

/** Conventional CLI exit codes. */
export const EXIT_OK = 0;
export const EXIT_NO_MATCHES = 1;
export const EXIT_ERROR = 2;
