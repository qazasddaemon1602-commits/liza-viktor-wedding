import { describe, expect, it } from 'vitest';
import { routeRedirects } from './routes';

describe('routeRedirects', () => {
  it('sends the bare domain to guest registration', () => {
    expect(routeRedirects['/']).toBe('/join');
  });

  it('routes legacy projector and premiere entry points to the real screen', () => {
    expect(routeRedirects['/screen/connect']).toBe('/screen');
    expect(routeRedirects['/premiere']).toBe('/screen');
  });
});
