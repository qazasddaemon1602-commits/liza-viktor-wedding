import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminPage } from '../features/admin/AdminPage';
import { BunkerScreenGuard } from '../features/bunker/BunkerScreenGuard';
import { MortalKombatPage } from '../features/mortalKombat/MortalKombatPage';
import { MkScreenPage } from '../features/mortalKombat/MkScreenPage';
import { CouplePreanswersPage } from '../features/quiz/CouplePreanswersPage';
import { FinalFiveRolePage } from '../features/quiz/FinalFiveRolePage';
import { GuestQuizPage } from '../features/quiz/GuestQuizPage';
import { GuestJoinPage } from '../features/registration/GuestJoinPage';
import { ScreenPage } from '../features/screen/ScreenPage';
import { WeddingHomePage } from '../features/wedding/WeddingHomePage';

export const routePaths = [
  '/',
  '/join',
  '/play',
  '/couple-preanswers',
  '/liza',
  '/viktor',
  '/admin',
  '/screen',
  '/screen/connect',
  '/premiere',
  '/mortal-kombat',
  '/mortal-kombat/screen',
] as const;

export const routeRedirects = {
  '/screen/connect': '/screen',
  '/premiere': '/screen',
} as const;

function currentJoinUrl(): string {
  return new URL('/join', window.location.origin).toString();
}

function projector(element: ReactNode) {
  return <BunkerScreenGuard eventSlug="liza-viktor">{element}</BunkerScreenGuard>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WeddingHomePage />} />
      <Route path="/join" element={<GuestJoinPage />} />
      <Route path="/play" element={<GuestQuizPage />} />
      <Route path="/couple-preanswers" element={<CouplePreanswersPage />} />
      <Route path="/liza" element={<FinalFiveRolePage role="liza" />} />
      <Route path="/viktor" element={<FinalFiveRolePage role="viktor" />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/screen" element={projector(<ScreenPage joinUrl={currentJoinUrl()} eventSlug="liza-viktor" />)} />
      <Route path="/screen/connect" element={<Navigate to={routeRedirects['/screen/connect']} replace />} />
      <Route path="/premiere" element={<Navigate to={routeRedirects['/premiere']} replace />} />
      <Route path="/mortal-kombat" element={<MortalKombatPage eventSlug="liza-viktor" />} />
      <Route path="/mortal-kombat/screen" element={projector(<MkScreenPage eventSlug="liza-viktor" />)} />
      <Route path="*" element={<Navigate to="/join" replace />} />
    </Routes>
  );
}
