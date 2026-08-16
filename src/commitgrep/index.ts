/** Public API surface for CommitGrep. */

export type { Commit, Match, Report, ReportFormat, SearchOptions } from "./models.js";
export { EXIT_ERROR, EXIT_NO_MATCHES, EXIT_OK } from "./models.js";
export {
  CommitGrepError,
  BinaryContentError,
  InvalidDateError,
  InvalidPatternError,
  NotARepositoryError,
  PathTraversalError,
} from "./errors.js";
export { formatText, search, validatePaths } from "./engine.js";
export { assertIsoDate, parseLog, resolveRepository } from "./log.js";
export { commitTouchesDiff } from "./diff.js";
