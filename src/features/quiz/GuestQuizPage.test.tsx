import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  GuestQuizPage,
  type GuestQuizPageDependencies,
} from './GuestQuizPage';
import type { GuestQuizState } from './quiz.service';

const votingState: GuestQuizState = {
  status: 'active',
  phase: 'voting',
  question: {
    id: 'question-1',
    text: 'Кто дольше собирается?',
    questionType: 'standard',
    imagePath: null,
  },
  selectedChoice: null,
  answeredCount: 17,
};

describe('GuestQuizPage', () => {
  it('shows the current question, submits one answer, then locks both choices without exposing results', async () => {
    const load = vi.fn().mockResolvedValue(votingState);
    const vote = vi.fn().mockResolvedValue({ status: 'accepted', choice: 'viktor' });
    const dependencies: GuestQuizPageDependencies = {
      getDeviceKey: () => 'lvw_device_1234',
      load,
      vote,
    };

    render(<GuestQuizPage dependencies={dependencies} />);

    expect(await screen.findByRole('heading', { name: 'Кто дольше собирается?' })).toBeInTheDocument();
    const lizaButton = screen.getByRole('button', { name: 'ЛИЗА' });
    const viktorButton = screen.getByRole('button', { name: 'ВИКТОР' });

    expect(lizaButton).toBeEnabled();
    expect(viktorButton).toBeEnabled();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();

    fireEvent.click(viktorButton);

    await waitFor(() => {
      expect(vote).toHaveBeenCalledWith('lvw_device_1234', 'question-1', 'viktor');
    });
    await waitFor(() => expect(screen.getByText('ОТВЕТ ПРИНЯТ')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'ЛИЗА' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ВИКТОР' })).toBeDisabled();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('sends an unregistered phone back to guest registration', async () => {
    const dependencies: GuestQuizPageDependencies = {
      getDeviceKey: () => 'lvw_device_new',
      load: vi.fn().mockResolvedValue({ status: 'not_registered' }),
      vote: vi.fn(),
    };

    render(<GuestQuizPage dependencies={dependencies} />);

    expect(await screen.findByRole('heading', { name: 'СНАЧАЛА ПОЛУЧИТЕ БИЛЕТ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ПОЛУЧИТЬ БИЛЕТ' })).toHaveAttribute('href', '/join');
  });

  it('shows aggregate percentages only after the owner reveals results', async () => {
    const dependencies: GuestQuizPageDependencies = {
      getDeviceKey: () => 'lvw_device_1234',
      load: vi.fn().mockResolvedValue({
        ...votingState,
        phase: 'results',
        selectedChoice: 'liza',
        answeredCount: 30,
        results: { liza: 18, viktor: 12, total: 30 },
      }),
      vote: vi.fn(),
    };

    render(<GuestQuizPage dependencies={dependencies} />);

    expect(await screen.findByText('60%')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('30 ответили')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ЛИЗА' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ВИКТОР' })).toBeDisabled();
  });
});
