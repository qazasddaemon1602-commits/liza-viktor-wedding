import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { registerWeddingServiceWorker } from './pwa/registerServiceWorker';
import './styles/globals.css';
import './styles/theme-tokens.css';
import './styles/wedding-editorial.css';
import './styles/wedding-home.css';
import './styles/wedding-registration.css';
import './styles/guest-hub.css';
import './styles/admin.css';
import './styles/admin-rehearsal.css';
import './styles/admin-sync.css';
import './styles/admin-bunker.css';
import './styles/train-arrival.css';
import './styles/scene-transition.css';
import './styles/screen-announcements.css';
import './styles/screen-controls.css';
import './styles/quiz.css';
import './styles/quiz-live-controls.css';
import './styles/wedding-scenes.css';
import './styles/premiere.css';
import './styles/admin-premiere.css';
import './styles/admin-reset.css';
import './styles/mortal-kombat.css';
import './styles/mk-milestones.css';
import './styles/mk-artbook.css';
import './styles/bunker.css';
import './styles/bunker-player.css';
import './styles/bunker-quest.css';
import './styles/bunker-v2-projector.css';
import './styles/mobile-hardening.css';
import './styles/bunker-projector-contrast.css';
import './styles/bunker-wedding-theme.css';
import './styles/bunker-accessibility.css';
import './styles/wedding-live.css';
import './styles/wedding-radio.css';
import './styles/wedding-nominations.css';
import './styles/carriage-full-names.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element #root was not found');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD) {
  void registerWeddingServiceWorker();
}
