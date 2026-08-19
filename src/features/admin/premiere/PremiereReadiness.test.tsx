import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getPremiereReadiness, PremiereReadiness } from './PremiereReadiness';

const readyFixture = {
  expected: 40,
  registered: 32,
  quietMinutes: 7,
  projector: true,
  video: true,
  audio: true,
};

describe('premiere readiness', () => {
  it('can recommend the main group without requiring 40 of 40', () => {
    const readiness = getPremiereReadiness(readyFixture);

    expect(readiness.mainGroupReady).toBe(true);
    expect(readiness.state).toBe('ready');
  });

  it('waits while the room is still actively filling even when the count threshold is reached', () => {
    const readiness = getPremiereReadiness({ ...readyFixture, quietMinutes: 1 });

    expect(readiness.mainGroupReady).toBe(false);
    expect(readiness.state).toBe('waiting');
  });

  it('separates technical readiness from guest quorum', () => {
    const readiness = getPremiereReadiness({ ...readyFixture, audio: false });

    expect(readiness.mainGroupReady).toBe(true);
    expect(readiness.technicalReady).toBe(false);
    expect(readiness.state).toBe('technical_not_ready');
  });

  it('never indicates launch is automatic', () => {
    expect(getPremiereReadiness(readyFixture).autoStart).toBe(false);
  });

  it('renders advisory status and explicitly says it cannot block owner launch', () => {
    render(<PremiereReadiness inputs={readyFixture} />);

    expect(screen.getByText('32 / ~40')).toBeInTheDocument();
    expect(screen.getByText('7 мин назад')).toBeInTheDocument();
    expect(screen.getByText('ОСНОВНОЙ СОСТАВ СОБРАН')).toBeInTheDocument();
    expect(screen.getByText('ПРЕМЬЕРА ГОТОВА')).toBeInTheDocument();
    expect(screen.getByText(/НЕ БЛОКИРУЕТ ЗАПУСК/i)).toBeInTheDocument();
    expect(screen.getByText(/владелец вручную/i)).toBeInTheDocument();
  });
});
