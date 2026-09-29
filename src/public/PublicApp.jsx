// Pages customers open from a link: /book (request a booking), /review[/token] (rate a stay), /pay/token (pay by PromptPay).
import './public.css';
import BookPage from './BookPage.jsx';
import ReviewPage from './ReviewPage.jsx';
import PayPage from './PayPage.jsx';

export default function PublicApp() {
  const [, page, token] = window.location.pathname.split('/');
  return (
    <div className="pub">
      <header className="pub-head">
        <div className="brand-name">คะนึงถึงโฮมสเตย์</div>
        <div className="muted-12">ห้วยกุ๊บกั๊บ</div>
      </header>
      <main className="pub-main">
        {page === 'book' && <BookPage />}
        {page === 'review' && <ReviewPage token={token ? decodeURIComponent(token) : ''} />}
        {page === 'pay' && <PayPage token={token ? decodeURIComponent(token) : ''} />}
      </main>
    </div>
  );
}
