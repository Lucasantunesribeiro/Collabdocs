import { describe, it, expect } from 'vitest';
import { buildTargetUrl } from '../../src/lib/proxy-path';

describe('buildTargetUrl (proxy /api/dotnet)', () => {
  const base = 'http://api.internal/api/';

  it('builds the upstream URL for document routes', () => {
    expect(buildTargetUrl(base, ['documents', '0b6f6f3e-1a2b-4c3d-8e9f-0123456789ab', 'collaborators']))
      .toBe('http://api.internal/api/documents/0b6f6f3e-1a2b-4c3d-8e9f-0123456789ab/collaborators');
  });

  it.each([[['..', 'health']], [['documents', '.']], [['documents%2F..']], [['a/b']], [['a\\b']], [[]]])(
    'rejects unsafe segments %j',
    (segments) => {
      expect(buildTargetUrl(base, segments as string[])).toBeNull();
    }
  );
});
