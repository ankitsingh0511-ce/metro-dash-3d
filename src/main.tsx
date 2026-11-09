import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';

// Rendered without <StrictMode>: its dev-only double mount would create two WebGL contexts for the game canvas.
createRoot(document.getElementById('root')!).render(<App />);
