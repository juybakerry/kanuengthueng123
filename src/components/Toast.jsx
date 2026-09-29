import { Icon } from './ui.jsx';

export default function Toast({ text }) {
  return (
    <div className="toast" role="status">
      <div className="toast-body"><Icon.Check /><span>{text}</span></div>
      <div className="toast-bar" />
    </div>
  );
}
