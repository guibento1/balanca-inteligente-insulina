import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import api from '../services/axios.js';
import { useUser } from '../context/UserContext.jsx';

const Login = () => {
	const { user, setUser } = useUser();
	const navigate = useNavigate();
	const [users, setUsers] = useState([]);
	const [query, setQuery] = useState('');
	const [selectedId, setSelectedId] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchUsers = async () => {
			setLoading(true);
			try {
				const { data } = await api.get('users/');
				const results = Array.isArray(data) ? data : data.results ?? [];
				setUsers(results);
				setSelectedId((prev) => {
					if (prev) return prev;
					if (results.length === 1) {
						return String(results[0].id);
					}
					return prev;
				});
			} catch (err) {
				setError('Não foi possível carregar os utilizadores.');
				console.error(err);
			} finally {
				setLoading(false);
			}
		};

		fetchUsers();
	}, []);

	const filteredUsers = useMemo(() => {
		if (!query) return users;
		return users.filter((item) => item.username.toLowerCase().includes(query.toLowerCase()));
	}, [users, query]);

	const handleSubmit = (event) => {
		event.preventDefault();
		const selected = users.find((item) => String(item.id) === String(selectedId));
		if (!selected) {
			setError('Selecione um utilizador.');
			return;
		}
		setUser(selected);
		navigate('/dados');
	};

	if (user) {
		return <Navigate to="/dados" replace />;
	}

	return (
		<div className="login-page">
			<form onSubmit={handleSubmit} className="login-card">
				<h1>Olá!</h1>
				<p>Escolha o perfil que pretende utilizar no painel.</p>
				<div className="field">
					<label htmlFor="search">Procurar</label>
					<input
						id="search"
						type="text"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Nome do utilizador"
					/>
				</div>
				<div className="field">
					<label>Utilizadores disponíveis</label>
					<div className="select-list">
						{filteredUsers.map((item) => {
							const isActive = String(item.id) === String(selectedId);
							return (
								<button
									type="button"
									key={item.id}
									onClick={() => setSelectedId(String(item.id))}
									className={`select-item ${isActive ? 'active' : ''}`}
								>
									{item.username}
								</button>
							);
						})}
						{!filteredUsers.length && <p className="text-muted" style={{ padding: '1rem' }}>Sem resultados.</p>}
					</div>
				</div>
				{error && <p className="text-muted" style={{ color: 'var(--danger)' }}>{error}</p>}
				<button type="submit" disabled={loading || !selectedId} className="primary-btn" style={{ width: '100%' }}>
					{loading ? 'A carregar…' : 'Entrar'}
				</button>
			</form>
		</div>
	);
};

export default Login;
