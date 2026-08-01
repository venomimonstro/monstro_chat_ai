export type PromptExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

export interface PromptExperimentDto {
  id: string;
  tenantId: string;
  name: string;
  promptAId: string;
  promptBId: string;
  trafficBPercent: number;
  status: PromptExperimentStatus;
  minSampleSize: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromptExperimentDto {
  name: string;
  promptAId: string;
  promptBId: string;
  trafficBPercent?: number;
  minSampleSize?: number;
}

export interface PromptExperimentReportDto {
  experimentId: string;
  name: string;
  periodDays: number;
  variantA: {
    dialogs: number;
    leads: number;
    conversionRate: number;
  };
  variantB: {
    dialogs: number;
    leads: number;
    conversionRate: number;
  };
  minSampleSize: number;
  sampleSizeReached: boolean;
}
