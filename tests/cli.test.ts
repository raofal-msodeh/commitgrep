/** CLI behavior tests using a child process against a fixture repo. */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

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
  fs.writeFileSync(path.join(root, "a.txt"), "hello\n");
  git(["add", "a.txt"]);
  git(["commit", "-q", "-m", "initial commit"]);
  fs.writeFileSync(path.join(root, "b.txt"), "secret\n");
  git(["add", "b.txt"]);
  git(["commit", "-q", "-m", "add secret config"]);
  return tmpDir;
}

function runCli(args: string[], cwd: string): { code: number; out: string; err: string } {
  try {
    const out = execFileSync("node", [path.resolve("dist/cli.js"), ...args], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out, err: "" };
  } catch (error) {
    return {
      code: (error as { status: number }).status ?? 2,
      out: (error as { stdout: string }).stdout ?? "",
      err: (error as { stderr: string }).stderr ?? "",
    };
  }
}

describe("commitgrep CLI", () => {
  it("matches a message and exits 0", () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    const result = runCli([root, "-m", "secret"], tmpDir);
    expect(result.code).toBe(0);
    expect(result.out).toContain("add secret config");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("exits 1 when there are no matches", () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    const result = runCli([root, "-m", "nonexistent-xyz"], tmpDir);
    expect(result.code).toBe(1);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("exits 2 for a non-repository root", () => {
    const tmpDir = makeRepo();
    const result = runCli([tmpDir], tmpDir);
    expect(result.code).toBe(2);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("exits 2 for a relative root", () => {
    const tmpDir = makeRepo();
    const result = runCli(["relative-repo", "-m", "x"], tmpDir);
    expect(result.code).toBe(2);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("emits JSON format", () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    const result = runCli([root, "-m", "secret", "--format", "json"], tmpDir);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.out);
    expect(payload.matchCount).toBe(1);
    expect(payload.matches[0].reasons).toContain("message");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("emits count format", () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    const result = runCli([root, "-a", "Ada", "--format", "count"], tmpDir);
    expect(result.code).toBe(0);
    expect(result.out.trim()).toBe("2");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes a report file", () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    const reportPath = path.join(tmpDir, "report.json");
    const result = runCli([root, "-m", "secret", "-r", reportPath], tmpDir);
    expect(result.code).toBe(0);
    expect(fs.existsSync(reportPath)).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects a relative report path", () => {
    const tmpDir = makeRepo();
    const root = path.join(tmpDir, "repo");
    const result = runCli([root, "-r", "rel.json"], tmpDir);
    expect(result.code).toBe(2);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
