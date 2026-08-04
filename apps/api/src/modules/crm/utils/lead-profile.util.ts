import type { SourceLeadConfig } from '@ai-consultant/shared-types';

export type LeadField = 'phone' | 'email' | 'name';

export type LeadProfileMode =
  | 'phone'
  | 'phone_name'
  | 'phone_name_surname'
  | 'phone_name_surname_email';

export function resolveLeadProfileMode(
  config?: SourceLeadConfig,
): LeadProfileMode {
  if (config?.profileMode) return config.profileMode;
  const fields = config?.requiredFields;
  if (!fields?.length) return 'phone';
  if (fields.includes('email') && fields.includes('name')) {
    return 'phone_name_surname_email';
  }
  if (fields.includes('name')) return 'phone_name';
  return 'phone';
}

export function requiredFieldsForMode(mode: LeadProfileMode): LeadField[] {
  switch (mode) {
    case 'phone':
      return ['phone'];
    case 'phone_name':
      return ['phone', 'name'];
    case 'phone_name_surname':
      return ['phone', 'name'];
    case 'phone_name_surname_email':
      return ['phone', 'name', 'email'];
    default:
      return ['phone'];
  }
}

export function nameMeetsProfile(
  name: string | null | undefined,
  mode: LeadProfileMode,
): boolean {
  if (!name?.trim()) return false;
  if (mode === 'phone_name_surname' || mode === 'phone_name_surname_email') {
    return name.trim().split(/\s+/).length >= 2;
  }
  return true;
}

export function missingLeadFields(
  mode: LeadProfileMode,
  data: { phone?: string | null; email?: string | null; name?: string | null },
): LeadField[] {
  const required = requiredFieldsForMode(mode);
  const missing: LeadField[] = [];
  for (const field of required) {
    if (field === 'name') {
      if (!nameMeetsProfile(data.name, mode)) missing.push('name');
    } else if (!data[field]) {
      missing.push(field);
    }
  }
  return missing;
}

/** Enough to open a CRM card early (Sprint 59 partial leads). */
export function canCreatePartialLead(data: {
  phone?: string | null;
}): boolean {
  return Boolean(data.phone?.trim());
}

function missingLabels(
  mode: LeadProfileMode,
  missing: LeadField[],
): string {
  const labels: Record<LeadField, string> = {
    phone: 'телефон для связи',
    name: 'имя',
    email: 'email',
  };

  let nameHint = 'имя';
  if (mode === 'phone_name_surname') {
    nameHint = 'имя и фамилию';
  } else if (mode === 'phone_name_surname_email') {
    nameHint = 'имя, фамилию и email';
  }

  return missing.map((f) => (f === 'name' ? nameHint : labels[f])).join(', ');
}

export function leadGoalInstruction(
  mode: LeadProfileMode,
  missing: LeadField[],
  options?: { askNow?: boolean },
): string | null {
  if (!missing.length) return null;

  const need = missingLabels(mode, missing);
  const askNow = options?.askNow !== false;

  if (!askNow) {
    return (
      `[Цель диалога — лид]\n` +
      `Консультируй по делу. Пока НЕ запрашивай контакт и НЕ используй блок ---contact---. ` +
      `Сначала ответь на вопрос. Когда посетитель проявит интерес (цена, сроки, подключение) — тогда мягко запроси: ${need}.`
    );
  }

  return (
    `[Цель диалога — лид]\n` +
    `Главная задача: консультировать и мягко довести посетителя до заявки. ` +
    `Сначала ответь на вопрос пользователя отдельным абзацем. ` +
    `Затем запрос контакта оформи ОТДЕЛЬНЫМ блоком — не в том же абзаце:\n` +
    `---contact---\n` +
    `Короткий запрос недостающих данных: ${need} (1–2 предложения).\n` +
    `---end---\n` +
    `Не навязывайся агрессивно. Когда все данные получены — подтверди заявку и поблагодари. ` +
    `Не предлагай передать диалог оператору.`
  );
}
