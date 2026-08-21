import { describe, expect, it } from 'vitest';
import { routeRedirects } from './routes';

describe('routeRedirects', () => {
  it('does not redirect the bare domain away from the wedding home', () => {
    expect(routeRedirects).not.toHaveProperty('/');
  });

  it('routes legacy projector and premiere entry points to the real screen', () => {
    expect(routeRedirects['/screen/connect']).toBe('/screen');
    expect(routeRedirects['/premiere']).toBe('/screen');
  });
});
