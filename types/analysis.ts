export type RuleFindingType =
  | "permission"
  | "dependency"
  | "security"
  | "test-missing"
  | "large-change"
  | "maintainability"
  | "type-safety";

export type RuleFindingLevel = "low" | "medium" | "high";

export type RuleFinding = {
  type: RuleFindingType;
  level: RuleFindingLevel;
  filePath: string;
  message: string;
};

