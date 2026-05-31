export type ParsedPrUrl = {
  owner: string;
  repo: string;
  pullNumber: number;
  normalizedUrl: string;
};

export type PrInfo = {
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  description: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  url: string;
  state: string;
};

export type ChangedFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
};

export type ContextFile = {
  path: string;
  content: string;
};

export type FetchedPrData = {
  pr: PrInfo;
  files: ChangedFile[];
  contextFiles: ContextFile[];
};
