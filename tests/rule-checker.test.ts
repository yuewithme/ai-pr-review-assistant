import assert from "node:assert/strict";
import test from "node:test";

import { checkRules } from "../lib/rule-checker.ts";
import type { ChangedFile } from "../types/github.ts";

function changedFile(overrides: Partial<ChangedFile>): ChangedFile {
  return {
    filename: "src/app.ts",
    status: "modified",
    additions: 1,
    deletions: 0,
    changes: 1,
    patch: "",
    ...overrides,
  };
}

test("checkRules flags path, dependency, security, deletion, size, and patch findings", () => {
  const findings = checkRules([
    changedFile({ filename: "src/auth/middleware.ts" }),
    changedFile({ filename: "package.json" }),
    changedFile({ filename: "config/secrets.ts" }),
    changedFile({ filename: "src/user.spec.ts", status: "removed" }),
    changedFile({ filename: "src/large.ts", changes: 301 }),
    changedFile({
      filename: "src/debug.ts",
      patch: "+ console.log(value)\n+ const payload: any = {}\n+ // TODO clean up",
    }),
  ]);

  assert.deepEqual(
    findings.map((finding) => finding.type),
    [
      "permission",
      "dependency",
      "security",
      "test-missing",
      "large-change",
      "maintainability",
      "type-safety",
      "maintainability",
    ],
  );
  assert.ok(findings.every((finding) => finding.filePath));
  assert.ok(findings.every((finding) => finding.message));
});

test("checkRules treats rule findings as analysis references", () => {
  const [finding] = checkRules([
    changedFile({ filename: "src/login/page.ts", patch: "+ console.log('debug')" }),
  ]);

  assert.equal(finding.level, "medium");
  assert.equal(finding.filePath, "src/login/page.ts");
  assert.match(finding.message, /AI analysis reference/i);
});

