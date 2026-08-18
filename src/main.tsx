import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/globals.css';
import './styles/train-arrival.css';
import './styles/screen-announcements.css';
import './styles/screen-controls.css';
import './styles/quiz.css';
import './styles/premiere.css';
import './styles/admin-premiere.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element #root was not found');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
