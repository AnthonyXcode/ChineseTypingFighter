import { useEffect } from 'react';
import './App.css';
import { useApp } from './ui/store';
import { Home } from './ui/screens/Home';
import { Settings } from './ui/screens/Settings';
import { Learn } from './ui/screens/Learn';
import { Test } from './ui/screens/Test';
import { Challenge } from './ui/screens/Challenge';
import { Leaderboard } from './ui/screens/Leaderboard';
import { Charts } from './ui/screens/Charts';

export default function App() {
  const screen = useApp((s) => s.screen);
  const theme = useApp((s) => s.settings.theme);
  const loading = useApp((s) => s.loading);
  const error = useApp((s) => s.error);
  const init = useApp((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const needsData = screen !== 'home' && screen !== 'settings' && screen !== 'leaderboard' && screen !== 'charts';
  let body;
  if (needsData && (loading || error)) {
    body = <Home />;
  } else {
    switch (screen) {
      case 'settings':
        body = <Settings />;
        break;
      case 'learn':
        body = <Learn />;
        break;
      case 'review':
        body = <Learn review />;
        break;
      case 'test':
        body = <Test />;
        break;
      case 'challenge':
        body = <Challenge />;
        break;
      case 'leaderboard':
        body = <Leaderboard />;
        break;
      case 'charts':
        body = <Charts />;
        break;
      default:
        body = <Home />;
    }
  }
  return (
    <div className="app" key={screen}>
      {body}
    </div>
  );
}
