import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../styles/wedding-home.css';
import { WeddingHomePage } from './WeddingHomePage';

const sectionLinks = [
  ['Наша история', '#story'],
  ['Программа', '#schedule'],
  ['Место', '#venue'],
  ['Галерея', '#gallery'],
  ['Регистрация', '#rsvp'],
] as const;

describe('WeddingHomePage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('introduces Лиза and Виктор with the wedding date, not the second-day event date', () => {
    render(<WeddingHomePage />);

    const hero = screen.getByRole('region', { name: 'Лиза и Виктор' });
    expect(within(hero).getByRole('heading', { level: 1, name: 'Лиза и Виктор' })).toBeInTheDocument();
    expect(within(hero).getByText('29 августа 2026')).toBeInTheDocument();
    expect(within(hero).queryByText('30 августа 2026')).not.toBeInTheDocument();
    expect(within(hero).getByText('29·08')).toBeInTheDocument();
  });

  it('uses all four local editorial image slots with anonymous descriptive alternatives', () => {
    const { container } = render(<WeddingHomePage />);

    const expectedImages = [
      ['Свадебная пара у поезда', '/images/wedding/editorial-hero.png'],
      ['Руки молодожёнов в купе поезда', '/images/wedding/editorial-story.png'],
      ['Зал для свадебного ужина в здании вокзала', '/images/wedding/editorial-venue.png'],
      ['Железнодорожный билет, кольца и цветы у окна поезда', '/images/wedding/editorial-ticket-still.png'],
    ] as const;

    for (const [alt, src] of expectedImages) {
      const image = screen.getByRole('img', { name: alt });
      expect(image).toHaveAttribute('src', src);
      const picture = image.closest('picture');
      expect(picture, `${src} must keep modern responsive sources`).not.toBeNull();
      expect(picture?.querySelector('source[type="image/avif"]')?.getAttribute('srcset')).toMatch(/\.avif/);
      expect(picture?.querySelector('source[type="image/webp"]')?.getAttribute('srcset')).toMatch(/\.webp/);
    }

    const editorialImages = Array.from(container.querySelectorAll('img'));
    expect(editorialImages).toHaveLength(expectedImages.length);
    for (const image of editorialImages) {
      expect(image.getAttribute('alt')).not.toMatch(/Лиза|Виктор/i);
    }
  });

  it('connects the editorial navigation to all five semantic sections', () => {
    const { container } = render(<WeddingHomePage />);
    const navigation = screen.getByRole('navigation', { name: 'Основная навигация' });

    for (const [label, href] of sectionLinks) {
      expect(within(navigation).getByRole('link', { name: label })).toHaveAttribute('href', href);
      expect(container.querySelector(`section${href}`)).toBeInTheDocument();
    }
  });

  it('offers registration through the existing /join guest flow', () => {
    render(<WeddingHomePage />);

    expect(screen.getByRole('link', { name: 'Зарегистрироваться' })).toHaveAttribute('href', '/join');
  });

  it('counts down to the celebration and advances once per second', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T18:59:58.000Z'));

    render(<WeddingHomePage />);

    const countdown = screen.getByRole('timer', { name: 'До начала праздника' });
    expect(within(countdown).getByLabelText('Секунды')).toHaveTextContent('02');

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(within(countdown).getByLabelText('Секунды')).toHaveTextContent('01');
  });

  it('gives the interactive masthead monogram a 44 by 44 pixel target', () => {
    render(<WeddingHomePage />);

    const monogram = screen.getByRole('link', { name: 'Лиза и Виктор — в начало страницы' });
    const styles = getComputedStyle(monogram);

    expect(styles.minWidth).toBe('44px');
    expect(styles.minHeight).toBe('44px');
  });

  it('presents the gallery as a textual archive of established event facts', () => {
    const { container } = render(<WeddingHomePage />);
    const gallery = container.querySelector('#gallery');

    expect(gallery).not.toBeNull();
    expect(within(gallery as HTMLElement).getByRole('list', { name: 'Архив события' })).toBeInTheDocument();
    expect(within(gallery as HTMLElement).getByText('29 августа 2026')).toBeInTheDocument();
    expect(within(gallery as HTMLElement).getByText('30 августа 2026')).toBeInTheDocument();
    expect(within(gallery as HTMLElement).getByText('Тюмень')).toBeInTheDocument();
    expect(within(gallery as HTMLElement).getByText('Поезд Виктора')).toBeInTheDocument();
    expect(
      within(gallery as HTMLElement).getByRole('img', {
        name: 'Железнодорожный билет, кольца и цветы у окна поезда',
      }),
    ).toBeInTheDocument();
  });
});
