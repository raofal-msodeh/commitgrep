/** Typed error hierarchy for CommitGrep. */

export class CommitGrepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommitGrepError";
  }
}

/** The provided root is not a git repository. */
export class NotARepositoryError extends CommitGrepError {
  constructor(root: string) {
    super(`not a git repository: ${root}`);
    this.name = "NotARepositoryError";
  }
}

/** A path filter escapes the repository boundary. */
export class PathTraversalError extends CommitGrepError {
  constructor(path: string) {
    super(`path filter escapes repository: ${path}`);
    this.name = "PathTraversalError";
  }
}

/** An invalid regex pattern was supplied. */
export class InvalidPatternError extends CommitGrepError {
  constructor(pattern: string, cause: unknown) {
    super(`invalid regex pattern: ${pattern}`);
    this.name = "InvalidPatternError";
    this.cause = cause;
  }
}

/** The input contains non-UTF-8 content git cannot report safely. */
export class BinaryContentError extends CommitGrepError {
  constructor(details: string) {
    super(`binary content detected: ${details}`);
    this.name = "BinaryContentError";
  }
}

/** An ISO 8601 date filter could not be parsed. */
export class InvalidDateError extends CommitGrepError {
  constructor(value: string) {
    super(`invalid ISO 8601 date: ${value}`);
    this.name = "InvalidDateError";
  }
}
