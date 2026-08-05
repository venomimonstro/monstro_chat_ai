import type { PromptRegressionAssertions } from '@ai-consultant/shared-types';

export function evaluateAssertions(
  response: string,
  assertions: PromptRegressionAssertions,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  const normalized = response.trim();

  for (const phrase of assertions.mustContain ?? []) {
    if (!normalized.toLowerCase().includes(phrase.toLowerCase())) {
      failures.push(`Ответ должен содержать «${phrase}»`);
    }
  }

  for (const phrase of assertions.mustNotContain ?? []) {
    if (normalized.toLowerCase().includes(phrase.toLowerCase())) {
      failures.push(`Ответ не должен содержать «${phrase}»`);
    }
  }

  if (
    typeof assertions.minLength === 'number' &&
    normalized.length < assertions.minLength
  ) {
    failures.push(
      `Минимальная длина ответа ${assertions.minLength}, получено ${normalized.length}`,
    );
  }

  return { passed: failures.length === 0, failures };
}
