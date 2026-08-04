import {
  canCreatePartialLead,
  leadGoalInstruction,
  missingLeadFields,
  resolveLeadProfileMode,
} from './lead-profile.util';

describe('lead-profile.util', () => {
  it('resolves phone-only mode by default', () => {
    expect(resolveLeadProfileMode({ enabled: true })).toBe('phone');
  });

  it('detects missing surname in phone_name_surname mode', () => {
    const missing = missingLeadFields('phone_name_surname', {
      phone: '+79991234567',
      name: 'Иван',
    });
    expect(missing).toContain('name');
  });

  it('builds lead goal instruction when phone missing', () => {
    const instruction = leadGoalInstruction('phone_name', ['phone', 'name']);
    expect(instruction).toContain('телефон');
    expect(instruction).toContain('лид');
    expect(instruction).toContain('---contact---');
  });

  it('builds soft instruction when askNow is false', () => {
    const instruction = leadGoalInstruction('phone', ['phone'], {
      askNow: false,
    });
    expect(instruction).toContain('НЕ запрашивай контакт');
    expect(instruction).not.toMatch(/---contact---\n/);
  });

  it('allows partial lead when phone present', () => {
    expect(canCreatePartialLead({ phone: '+79991234567' })).toBe(true);
    expect(canCreatePartialLead({ phone: null })).toBe(false);
  });
});
