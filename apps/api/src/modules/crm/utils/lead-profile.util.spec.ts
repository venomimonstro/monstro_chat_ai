import {
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
  });
});
