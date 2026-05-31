import type { RuleFinding, RuleFindingLevel, RuleFindingType } from "../types/analysis.ts";
import type { ChangedFile } from "../types/github.ts";

const PERMISSION_PATH_PATTERN = /(auth|login|permission|token|middleware)/i;
const DEPENDENCY_PATH_PATTERN = /(^|\/)(package\.json|pnpm-lock\.yaml|yarn\.lock|package-lock\.json)$/i;
const SECURITY_PATH_PATTERN = /(^|\/)(\.env[^/]*|.*config.*|.*secret.*)/i;
const TEST_PATH_PATTERN = /(test|spec)\.[cm]?[jt]sx?$/i;

export function checkRules(changedFiles: ChangedFile[]): RuleFinding[] {
  return changedFiles.flatMap((file) => checkFileRules(file));
}

function checkFileRules(file: ChangedFile): RuleFinding[] {
  const findings: RuleFinding[] = [];
  const filePath = file.filename;

  if (PERMISSION_PATH_PATTERN.test(filePath)) {
    findings.push(
      createFinding(
        "permission",
        "medium",
        filePath,
        "Permission-sensitive path changed; use this as an AI analysis reference, not a final risk conclusion.",
      ),
    );
  }

  if (DEPENDENCY_PATH_PATTERN.test(filePath)) {
    findings.push(
      createFinding(
        "dependency",
        "medium",
        filePath,
        "Dependency manifest or lock file changed; use this as an AI analysis reference, not a final risk conclusion.",
      ),
    );
  }

  if (SECURITY_PATH_PATTERN.test(filePath)) {
    findings.push(
      createFinding(
        "security",
        "high",
        filePath,
        "Security or configuration-related file changed; use this as an AI analysis reference, not a final risk conclusion.",
      ),
    );
  }

  if (file.status === "removed" && TEST_PATH_PATTERN.test(filePath)) {
    findings.push(
      createFinding(
        "test-missing",
        "medium",
        filePath,
        "Test or spec file was deleted; use this as an AI analysis reference, not a final risk conclusion.",
      ),
    );
  }

  if (file.changes > 300) {
    findings.push(
      createFinding(
        "large-change",
        "medium",
        filePath,
        "Single file change exceeds 300 lines; use this as an AI analysis reference, not a final risk conclusion.",
      ),
    );
  }

  if (/console\.log/.test(file.patch)) {
    findings.push(
      createFinding(
        "maintainability",
        "low",
        filePath,
        "Patch contains console.log; use this as an AI analysis reference, not a final risk conclusion.",
      ),
    );
  }

  if (/\bany\b/.test(file.patch)) {
    findings.push(
      createFinding(
        "type-safety",
        "medium",
        filePath,
        "Patch contains TypeScript any; use this as an AI analysis reference, not a final risk conclusion.",
      ),
    );
  }

  if (/\bTODO\b/i.test(file.patch)) {
    findings.push(
      createFinding(
        "maintainability",
        "low",
        filePath,
        "Patch contains TODO; use this as an AI analysis reference, not a final risk conclusion.",
      ),
    );
  }

  return findings;
}

function createFinding(
  type: RuleFindingType,
  level: RuleFindingLevel,
  filePath: string,
  message: string,
): RuleFinding {
  return {
    type,
    level,
    filePath,
    message,
  };
}

