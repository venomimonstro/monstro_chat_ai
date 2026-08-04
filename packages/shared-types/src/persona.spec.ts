import {
  buildPersonaInstruction,
  DEFAULT_FORBIDDEN_PHRASES,
} from './persona';

describe('buildPersonaInstruction', () => {
  it('includes core persona rules and default style', () => {
    const instruction = buildPersonaInstruction();

    expect(instruction).toContain('[Стиль общения]');
    expect(instruction).toContain('не предлагай «передать менеджеру»');
    expect(instruction).toContain('живой менеджер');
    expect(instruction).toContain('возражениях');
  });

  it('includes custom forbidden phrases', () => {
    const instruction = buildPersonaInstruction({
      forbiddenPhrases: ['самый дешёвый'],
    });

    expect(instruction).toContain('«самый дешёвый»');
    for (const phrase of DEFAULT_FORBIDDEN_PHRASES) {
      expect(instruction).toContain(`«${phrase}»`);
    }
  });

  it('uses sales_closer style when configured', () => {
    const instruction = buildPersonaInstruction({
      personaStyle: 'sales_closer',
      objectionHandling: 'value_focus',
    });

    expect(instruction).toContain('Веди диалог к заявке');
    expect(instruction).toContain('ценность');
  });
});
