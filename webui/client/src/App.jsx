import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import MapPage from './pages/MapPage';
import CellsPage from './pages/CellsPage';
import AtlasPage from './pages/AtlasPage';
import GrowthPage from './pages/GrowthPage';
import AboutPage from './pages/AboutPage';
import HeartbeatPage from './pages/HeartbeatPage';
import AgentsPage from './pages/AgentsPage';
import UseCasePage from './pages/UseCasePage';
import MindPage from './pages/MindPage';

function UserMenu() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(setUser).catch(() => {});
  }, []);
  return (
    <div className="flex items-center gap-3">
      {user?.email && (
        <span className="text-xs text-slate-500">{user.displayName || user.email}</span>
      )}
      <button
        onClick={() => fetch('/api/logout', { method: 'POST' }).then(() => { window.location.href = '/login'; })}
        className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
      >
        Sign out
      </button>
    </div>
  );
}

function OllamaIndicator() {
  const [reachable, setReachable] = useState(null);

  useEffect(() => {
    const check = () =>
      fetch('/api/ollama/status')
        .then(r => r.json())
        .then(d => setReachable(d.reachable))
        .catch(() => setReachable(false));
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  if (reachable === null) return null;
  return (
    <div className="flex items-center gap-1.5" title={reachable ? 'LLM reachable' : 'LLM unreachable — status report and growth agents paused'}>
      <span className={`w-1.5 h-1.5 rounded-full ${reachable ? 'bg-green-400' : 'bg-red-500'}`} />
      <span className={`text-xs ${reachable ? 'text-green-400' : 'text-red-400'}`}>LLM</span>
    </div>
  );
}

const NAV = [
  { to: '/',        label: 'Dashboard' },
  { to: '/agents',  label: 'Agents' },
  { to: '/mind',    label: 'Mind' },
  { to: '/map',     label: 'Map' },
  { to: '/cells',   label: 'Cell Health' },
  { to: '/atlas',   label: 'Status' },
  { to: '/growth',  label: 'Expansion' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <nav className="border-b border-slate-800 bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
            <NavLink to="/about" title="About" className={({ isActive }) => `transition-colors mr-1 flex items-center gap-1.5 ${isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
              <span className="text-sm font-semibold tracking-tight hidden sm:inline">ATA</span>
            </NavLink>
            <div className="w-px h-5 bg-slate-700 mr-1" />
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors flex items-center gap-1.5 ${isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`
                }
              >
                {(to === '/' || to === '/agents' || to === '/mind') && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                )}
                {label}
              </NavLink>
            ))}
            <div className="ml-auto flex items-center gap-4">
              <OllamaIndicator />
              <UserMenu />
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/"      element={<Dashboard />} />
            <Route path="/map"   element={<MapPage />} />
            <Route path="/cells" element={<CellsPage />} />
            <Route path="/agents"    element={<AgentsPage />} />
            <Route path="/heartbeat" element={<HeartbeatPage />} />
            <Route path="/atlas"  element={<AtlasPage />} />
            <Route path="/growth" element={<GrowthPage />} />
            <Route path="/about"  element={<AboutPage />} />
            <Route path="/use-case" element={<UseCasePage />} />
            <Route path="/mind" element={<MindPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
