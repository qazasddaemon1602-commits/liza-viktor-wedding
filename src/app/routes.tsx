import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminPage } from '../features/admin/AdminPage';
import { GuestJoinPage } from '../features/registration/GuestJoinPage';
import { ScreenPage } from '../features/screen/ScreenPage';

export const routePaths = [
  '/',
  '/join',
  '/play',
  '/admin',
  '/screen',
  '/screen/connect',
  '/premiere',
  '/mortal-kombat',
  '/mortal-kombat/screen',
] as const;

function PlaceholderPage({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <main className="page-shell">
      <section className="placeholder-card">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
    </main>
  );
}

function currentJoinUrl(): string {
  return new URL('/join', window.location.origin).toString();
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PlaceholderPage eyebrow="30 · 08 · 2026" title="ЛИЗА × ВИКТОР" description="Второй день. Один состав. Много историй." />} />
      <Route path="/join" element={<GuestJoinPage />} />
      <Route path="/play" element={<PlaceholderPage eyebrow="СЕЙЧАС В ИГРЕ" title="ЛИЗА ИЛИ ВИКТОР?" description="Здесь появится активный вопрос." />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/screen" element={<ScreenPage joinUrl={currentJoinUrl()} eventSlug="liza-viktor" />} />
      <Route path="/screen/connect" element={<PlaceholderPage eyebrow="ПОДКЛЮЧЕНИЕ ЭКРАНА" title="PAIRING" description="Безопасное подключение телевизора к событию." />} />
      <Route path="/premiere" element={<PlaceholderPage eyebrow="ПРЕМЬЕРА" title="КОЛЬЦО" description="Видео будет подготовлено до запуска обратного отсчёта." />} />
      <Route path="/mortal-kombat" element={<PlaceholderPage eyebrow="16 ИГРОКОВ" title="MORTAL KOMBAT" description="Регистрация, текущий бой и турнирная сетка." />} />
      <Route path="/mortal-kombat/screen" element={<PlaceholderPage eyebrow="ТУРНИР" title="MORTAL KOMBAT" description="Большой экран турнирной сетки." />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
