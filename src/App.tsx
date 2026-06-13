import { useState } from 'react';
import Homepage from './landingPages/Homepage';
import Dashboard from './dashboard';

type View = 'home' | 'dashboard';

function App() {
  const [view, setView] = useState<View>('home');

  if (view === 'dashboard') {
    return <Dashboard onBack={() => setView('home')} />;
  }

  return <Homepage onNavigate={() => setView('dashboard')} />;
}

export default App;
