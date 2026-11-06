import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import CatalogoAlimentos from './views/CatalogoAlimentos.jsx';
import Pesagem from './views/Pesagem.jsx';
import Historico from './views/Historico.jsx';
import Login from './views/Login.jsx';
import DadosUtilizador from './views/DadosUtilizador.jsx';
import { useUser } from './context/UserContext.jsx';
import RequireUser from './components/RequireUser.jsx';

const navLinks = [
  { to: '/dados', label: 'Dados clínicos' },
  { to: '/catalogo', label: 'Catálogo' },
  { to: '/pesagem', label: 'Pesagem' },
  { to: '/historico', label: 'Histórico' },
];

const DashboardLayout = () => {
  const { user, clearUser } = useUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearUser();
    navigate('/login');
  };

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : '?';

  return (
    <div className="app-shell">
      <aside className="app-nav">
        <div>
          <p className="app-brand">Projeto SE</p>
          <p className="text-muted">Sistema Embebido de Pesagem Inteligente com Raspberry Pi HX711 e Django REST API para Cálculo de Insulina</p>
        </div>
        <div className="app-nav-links">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'app-nav-link active' : 'app-nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </aside>
      <div className="app-main">
        <header
          className="app-header"
          style={{ alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}
        >
          <div className="user-pill" style={{ alignItems: 'center', gap: '0.75rem' }}>
            <span className="user-pill-avatar" style={{ fontSize: '1rem' }}>{initials}</span>
            <div style={{ lineHeight: 1.2 }}>
              <p className="stat-chip" style={{ marginBottom: '0.2rem' }}>Utilizador ativo</p>
              <p className="stat-value" style={{ fontSize: '1.15rem', margin: 0 }}>{user?.username ?? 'Desconhecido'}</p>
            </div>
          </div>
          <button type="button" onClick={handleLogout} style={{ minWidth: '160px' }}>
            Trocar utilizador
          </button>
        </header>
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          element={(
            <RequireUser>
              <DashboardLayout />
            </RequireUser>
          )}
        >
          <Route path="/dados" element={<DadosUtilizador />} />
          <Route path="/catalogo" element={<CatalogoAlimentos />} />
          <Route path="/pesagem" element={<Pesagem />} />
          <Route path="/historico" element={<Historico />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}