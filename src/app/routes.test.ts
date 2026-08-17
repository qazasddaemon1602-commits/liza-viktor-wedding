import { describe, expect, it } from 'vitest';
import { routePaths } from './routes';

describe('routePaths', () => {
  it('exposes the core guest, admin, screen, premiere and tournament routes', () => {
    expect(routePaths).toEqual([
      '/',
      '/join',
      '/play',
      '/admin',
      '/screen',
      '/screen/connect',
      '/premiere',
      '/mortal-kombat',
      '/mortal-kombat/screen',
    ]);
  });
});
