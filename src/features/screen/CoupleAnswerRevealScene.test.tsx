import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoupleAnswerRevealScene } from './CoupleAnswerRevealScene';

describe('CoupleAnswerRevealScene', () => {
  it('shows the joint choice and confirms when the guest majority guessed it', () => {
    render(
      <CoupleAnswerRevealScene
        question="Кто в доме главный?"
        choice="liza"
        results={{ liza: 7, viktor: 5, total: 12 }}
      />,
    );

    expect(screen.getByText('ОТВЕТ ЛИЗЫ И ВИКТОРА')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ЛИЗА' })).toBeInTheDocument();
    expect(screen.getByText('ГОСТИ УГАДАЛИ')).toBeInTheDocument();
    expect(screen.getByText('ЛИЗА 58%')).toBeInTheDocument();
    expect(screen.getByText('ВИКТОР 42%')).toBeInTheDocument();
  });

  it('shows the playful miss verdict when the majority chose the other person', () => {
    render(
      <CoupleAnswerRevealScene
        question="Кто первым мирится?"
        choice="viktor"
        results={{ liza: 9, viktor: 3, total: 12 }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'ВИКТОР' })).toBeInTheDocument();
    expect(screen.getByText('А ВОТ И НЕТ')).toBeInTheDocument();
  });

  it('handles a tied guest vote without pretending that the guests guessed', () => {
    render(
      <CoupleAnswerRevealScene
        question="Кто транжира?"
        choice="liza"
        results={{ liza: 6, viktor: 6, total: 12 }}
      />,
    );

    expect(screen.getByText('ГОСТИ НЕ ОПРЕДЕЛИЛИСЬ')).toBeInTheDocument();
  });
});
