/** Engine tests against a fresh local git repository fixture. */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { search } from "../src/commitgrep/engine.js";
import { parseLog } from "../src/commitgrep/log.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Ada Lovelace",
  GIT_AUTHOR_EMAIL: "ada@example.com",
  GIT_COMMITTER_NAME: "Ada Lovelace",
  GIT_COMMITTER_EMAIL: "ada@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
  HOME: "/tmp",
};

function makeRepo(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "commitgrep-"));
  const root = path.join(tmpDir, "repo");
  fs.mkdirSync(root);
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], env: GIT_ENV });
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.name", "Ada Lovelace"]);
  git(["config", "user.email", "ada@example.com"]);
  fs.writeFileSync(path.join(root, "a.txt"), "hello world\n");
  git(["add", "a.txt"]);
  git(["commit", "-q", "-m", "initial commit with greeting"]);
  fs.writeFileSync(path.join(root, "b.txt"), "secret token value\n");
  git(["add", "b.txt"]);
  git(["commit", "-q", "-m", "add config file"]);
  fs.writeFileSync(path.join(root, "c.txt"), "feature flag\n");
  git(["add", "c.txt"]);
  git(["commit", "-q", "-m", "Feat: add user authentication"]);
  return tmpDir;
}

describe("search — message filter", () => {
  it("finds commits matching a message regex", async () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    const report = await search({ root, messagePattern: "auth" });
    expect(report.matchCount).toBe(1);
    expect(report.matches[0].reasons).toEqual(["message"]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("is case-insensitive by default", async () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    const report = await search({ root, messagePattern: "FEAT" });
    expect(report.matchCount).toBe(1);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("respects case-sensitive flag", async () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    const report = await search({ root, messagePattern: "AUTH", caseSensitive: true });
    expect(report.matchCount).toBe(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("search — diff pickaxe", () => {
  it("finds commits that touched a diff term", async () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    const report = await search({ root, diffTerm: "secret" });
    expect(report.matchCount).toBe(1);
    expect(report.matches[0].reasons).toEqual(["diff"]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("search — time window", () => {
  it("excludes commits outside the window", async () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    const report = await search({ root, until: "1990-01-01" });
    expect(report.matchCount).toBe(0);
    expect(report.totalCommitsWalked).toBe(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects invalid ISO dates", async () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    await expect(search({ root, since: "yesterday" })).rejects.toThrow();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("search — author filter", () => {
  it("matches author name", async () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    const report = await search({ root, authorPattern: "Ada" });
    expect(report.matchCount).toBe(3);
    expect(report.matches.every((m) => m.reasons.includes("author"))).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("search — path filter", () => {
  it("only includes commits touching the path", async () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    const report = await search({ root, paths: ["b.txt"] });
    expect(report.totalCommitsWalked).toBe(1);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects absolute path filters", async () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    await expect(search({ root, paths: ["/etc/passwd"] })).rejects.toThrow();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("search — repo validation", () => {
  it("throws on a non-repository root", async () => {
    await expect(search({ root: "/tmp" })).rejects.toThrow();
  });
});

describe("parseLog", () => {
  it("parses empty output", () => {
    expect(parseLog("")).toEqual([]);
  });
});
