import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { installGlobalInteractionAudio } from '../lib/siteAudio';
import { AppRoutes } from './routes';

export function App() {
  useEffect(() => installGlobalInteractionAudio(), []);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
