import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/modernist.css';
import './styles/app.css';

// Customer links (/book, /review, /pay) load only the small public bundle; everything else is the staff app.
const isPublic = /^\/(book|review|pay)(\/|$)/.test(window.location.pathname);
const Root = isPublic ? lazy(() => import('./public/PublicApp.jsx')) : lazy(() => import('./App.jsx'));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<div className="splash">กำลังโหลด…</div>}>
      <Root />
    </Suspense>
  </StrictMode>,
);
