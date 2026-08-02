export type SystemUpdateStatus =
  | 'pending'
  | 'testing'
  | 'test_passed'
  | 'test_failed'
  | 'awaiting_approval'
  | 'deploying'
  | 'canary_monitoring'
  | 'applied'
  | 'rolled_back';

export interface DeployLogEntry {
  at: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface TestReportDto {
  passed: boolean;
  startedAt: string;
  finishedAt: string;
  suites: Array<{
    name: string;
    passed: number;
    failed: number;
    durationMs: number;
  }>;
  error?: string;
}

export interface CanaryMetricsDto {
  errorRate: number;
  latencyP95Ms: number;
  sampleCount: number;
  thresholdErrorRate: number;
  passed: boolean;
  checkedAt: string;
}

export interface SystemUpdateDto {
  id: string;
  version: string;
  sprintNumber: number | null;
  changelog: string | null;
  gitSha: string | null;
  imageTag: string | null;
  status: SystemUpdateStatus;
  testReport: TestReportDto | null;
  deployLog: DeployLogEntry[];
  canaryMetrics: CanaryMetricsDto | null;
  backupSnapshotId: string | null;
  appliedAt: string | null;
  rollbackVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSystemUpdateDto {
  version: string;
  sprintNumber?: number;
  changelog?: string;
  gitSha?: string;
  imageTag?: string;
}

export interface ReleaseManifestDto {
  version: string;
  sprint: number;
  name?: string;
  gitSha?: string;
  previousVersion?: string;
  previousSprint?: number;
  deployedAt?: string | null;
  rolledBackAt?: string | null;
  deployTokenConfigured?: boolean;
}

export interface SprintInfoDto {
  number: number;
  status: string;
  description: string;
}

export interface ReleaseDeployInstructionsDto {
  updateId: string;
  version: string;
  sprintNumber: number | null;
  command: string;
  rollbackCommand: string;
  recommendedCommand: string;
  currentVersion: string;
  currentSprint: number;
  isStale: boolean;
  warning?: string;
}

export interface BackupSnapshotDto {
  id: string;
  label: string | null;
  storagePath: string;
  sizeBytes: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CreateBackupDto {
  label?: string;
}
