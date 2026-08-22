import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SceneTransition } from './SceneTransition';

describe('SceneTransition', () => {
  it('provides one reusable transition frame without hiding the scene from assistive technology', () => {
    render(
      <SceneTransition sceneKey="quiz-1-results" label="РЕЗУЛЬТАТЫ" tone="wine">
        <h1>Кто опаздывает чаще?</h1>
      </SceneTransition>,
    );

    const transition = screen.getByTestId('scene-transition');
    expect(transition).toHaveAttribute('data-scene-key', 'quiz-1-results');
    expect(transition).toHaveClass('scene-transition--wine');
    expect(screen.getByRole('heading', { name: 'Кто опаздывает чаще?' })).toBeInTheDocument();
    expect(screen.getByText('РЕЗУЛЬТАТЫ')).toHaveAttribute('aria-hidden', 'true');
  });
});
