import { hashPageContent } from './content-hash';

describe('hashPageContent', () => {
  it('returns stable hash for normalized text', () => {
    const a = hashPageContent('Hello   world');
    const b = hashPageContent('Hello world');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('differs when content changes', () => {
    expect(hashPageContent('page v1')).not.toBe(hashPageContent('page v2'));
  });
});
