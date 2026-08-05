export interface PromptRegressionAssertions {
  mustContain?: string[];
  mustNotContain?: string[];
  minLength?: number;
}

export interface PromptRegressionCaseDto {
  id: string;
  tenantId: string;
  sourceId: string | null;
  name: string;
  userMessage: string;
  assertions: PromptRegressionAssertions;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromptRegressionCaseDto {
  name: string;
  userMessage: string;
  sourceId?: string;
  assertions?: PromptRegressionAssertions;
  isActive?: boolean;
}

export interface UpdatePromptRegressionCaseDto {
  name?: string;
  userMessage?: string;
  sourceId?: string | null;
  assertions?: PromptRegressionAssertions;
  isActive?: boolean;
}

export interface PromptRegressionCaseResult {
  caseId: string;
  caseName: string;
  passed: boolean;
  response: string;
  failures: string[];
}

export interface PromptRegressionRunDto {
  id: string;
  tenantId: string;
  sourceId: string | null;
  promptId: string | null;
  passed: number;
  failed: number;
  results: PromptRegressionCaseResult[];
  createdAt: string;
}

export interface RunPromptRegressionDto {
  sourceId: string;
  clientPrompt: string;
}
