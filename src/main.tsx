import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/500.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import '@fontsource/mitr/400.css';
import '@fontsource/mitr/500.css';
import '@fontsource/itim/400.css';
import './app/styles.css';
import { registerSW } from './lib/pwa';

const path = location.pathname;
const root = createRoot(document.getElementById('root')!);

const BookPage = lazy(() => import('./public/BookPage').then((m) => ({ default: m.BookPage })));
const GuestReview = lazy(() => import('./public/GuestPages').then((m) => ({ default: m.ReviewPage })));
const GuestPay = lazy(() => import('./public/GuestPages').then((m) => ({ default: m.PayPage })));

async function start() {
  const review = path.match(/^\/review\/([\w-]+)/);
  const pay = path.match(/^\/pay\/([\w-]+)/);
  if (path === '/book' || path.startsWith('/book/') || review || pay) {
    await import('./public/public.css');
    root.render(
      <StrictMode>
        <Suspense fallback={null}>{review ? <GuestReview token={review[1]!} /> : pay ? <GuestPay token={pay[1]!} /> : <BookPage />}</Suspense>
      </StrictMode>,
    );
    return;
  }
  // แอปพนักงาน
  registerSW();
  const [{ App }, { boot }, { applyTheme }] = await Promise.all([import('./app/App'), import('./lib/store'), import('./app/theme')]);
  applyTheme();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await boot();
}

void start();
