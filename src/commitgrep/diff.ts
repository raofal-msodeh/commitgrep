/** Diff (pickaxe-style) detection for CommitGrep. */

import { spawnSync } from "node:child_process";

import { BinaryContentError } from "./errors.js";

/**
 * True when `term` appears in the diff between the commit and its first
 * parent — the same semantics as `git log -S <term>`.
 */
export function commitTouchesDiff(repoRoot: string, hash: string, term: string): boolean {
  const base = `${hash}^`;
  const probe = spawnSync(
    "git",
    ["-C", repoRoot, "cat-file", "-t", base],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
  );
  const args = ["-C", repoRoot, "diff", "-S", term, "--quiet"];
  if (probe.status !== 0) {
    // Root commit: diff against the empty tree.
    const emptyTree = spawnSync(
      "git",
      ["-C", repoRoot, "hash-object", "-t", "tree", "/dev/null"],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
    );
    if (emptyTree.status !== 0) {
      throw new BinaryContentError(`empty-tree lookup failed for ${hash}`);
    }
    args.push(emptyTree.stdout.trim(), hash);
  } else {
    args.push(base, hash);
  }
  const result = spawnSync("git", args, { encoding: "utf-8", stdio: ["ignore", "ignore", "pipe"] });
  if (result.status === 128) {
    throw new BinaryContentError(`git diff failed for ${hash}: ${result.stderr.trim()}`);
  }
  // status 1 = diff found (term touched), 0 = untouched, others = error
  if (result.status === 1) return true;
  if (result.status === 0) return false;
  throw new BinaryContentError(`git diff exited ${result.status} for ${hash}`);
}
