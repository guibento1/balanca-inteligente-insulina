import { useEffect, useMemo, useState } from 'react';
import api from '../services/axios.js';
import { cacheGet, cacheSet } from '../utils/cache.js';

const FOODS_CACHE_KEY = 'cache:foods';
const FOODS_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

const CatalogoAlimentos = () => {
	const [foods, setFoods] = useState([]);
	const [query, setQuery] = useState('');
	const [order, setOrder] = useState('name');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showAdd, setShowAdd] = useState(false);
	const [saving, setSaving] = useState(false);
	const [feedback, setFeedback] = useState(null);
	const [newFood, setNewFood] = useState({ name: '', carbs_per_100g: '', image_url: '' });

	useEffect(() => {
		let isMounted = true;
		const controller = new AbortController();
		const cachedFoods = cacheGet(FOODS_CACHE_KEY);
		const hasCached = Array.isArray(cachedFoods) && cachedFoods.length > 0;
		if (hasCached) {
			setFoods(cachedFoods);
			setLoading(false);
		} else {
			setLoading(true);
		}

		const fetchFoods = async () => {
			setError(null);
			try {
				const { data } = await api.get('foods/', { signal: controller.signal });
				const results = Array.isArray(data) ? data : data.results ?? [];
				if (isMounted) {
					setFoods(results);
					setLoading(false);
				}
				cacheSet(FOODS_CACHE_KEY, results, FOODS_CACHE_TTL);
			} catch (err) {
				if (controller.signal.aborted) return;
				console.error(err);
				if (isMounted) {
					setError('Não foi possível carregar o catálogo.');
					setLoading(false);
				}
			}
		};

		fetchFoods();

		return () => {
			isMounted = false;
			controller.abort();
		};
	}, []);

	const normalized = useMemo(() => {
		const filtered = foods.filter((food) =>
			food.name.toLowerCase().includes(query.toLowerCase()),
		);
		const sorted = [...filtered].sort((a, b) => {
			if (order === 'carbs') {
				return Number(b.carbs_per_100g) - Number(a.carbs_per_100g);
			}
			return a.name.localeCompare(b.name);
		});
		return sorted;
	}, [foods, query, order]);

	const handleAddFood = async (event) => {
		event.preventDefault();
		setFeedback(null);
		setSaving(true);
		try {
			const payload = {
				name: newFood.name.trim(),
				carbs_per_100g: newFood.carbs_per_100g,
				image_url: newFood.image_url?.trim() || undefined,
			};
			const { data } = await api.post('foods/', payload);
			setFoods((prev) => {
				const updated = [data, ...prev];
				cacheSet(FOODS_CACHE_KEY, updated, FOODS_CACHE_TTL);
				return updated;
			});
			setFeedback('Alimento criado com sucesso.');
			setNewFood({ name: '', carbs_per_100g: '', image_url: '' });
		} catch (err) {
			console.error(err);
			setFeedback('Não foi possível criar o alimento.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<section>
			<div className="section-heading">
				<h2>Catálogo de alimentos</h2>
				<p>Lista sincronizada com a base de dados PostgreSQL.</p>
			</div>
			<div className="app-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
					<div>
						<p className="stat-chip">Gestão</p>
						<h3 style={{ margin: '0.2rem 0 0' }}>Adicionar alimento</h3>
					</div>
					<button type="button" className="secondary-btn" onClick={() => setShowAdd((prev) => !prev)}>
						{showAdd ? 'Fechar' : 'Novo alimento'}
					</button>
				</div>
				{showAdd && (
					<form onSubmit={handleAddFood} className="form-grid cols-3">
						<div className="field">
							<label>Nome</label>
							<input
								type="text"
								required
								value={newFood.name}
								onChange={(event) => setNewFood((prev) => ({ ...prev, name: event.target.value }))}
								placeholder="Ex.: Banana"
							/>
						</div>
						<div className="field">
							<label>Carboidratos (g / 100g)</label>
							<input
								type="number"
								step="0.01"
								min="0"
								max="100"
								required
								value={newFood.carbs_per_100g}
								onChange={(event) => setNewFood((prev) => ({ ...prev, carbs_per_100g: event.target.value }))}
							/>
						</div>
						<div className="field">
							<label>Imagem (URL opcional)</label>
							<input
								type="url"
								value={newFood.image_url}
								onChange={(event) => setNewFood((prev) => ({ ...prev, image_url: event.target.value }))}
								placeholder="https://..."
							/>
						</div>
						<div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
							<button type="submit" className="primary-btn" disabled={saving}>
								{saving ? 'A criar…' : 'Guardar alimento'}
							</button>
							<button type="button" className="secondary-btn" onClick={() => setNewFood({ name: '', carbs_per_100g: '', image_url: '' })}>
								Limpar
							</button>
						</div>
						{feedback && (
							<p className="text-muted" style={{ color: feedback.includes('sucesso') ? undefined : 'var(--danger)' }}>
								{feedback}
							</p>
						)}
					</form>
				)}
			</div>
			<div className="app-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
				<div className="field" style={{ flex: '1 1 240px' }}>
					<label htmlFor="search-food">Filtrar por nome</label>
					<input
						id="search-food"
						type="search"
						placeholder="Ex.: Banana"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</div>
				<div className="field" style={{ width: '180px' }}>
					<label htmlFor="order-food">Ordenar por</label>
					<select id="order-food" value={order} onChange={(event) => setOrder(event.target.value)}>
						<option value="name">Ordem alfabética</option>
						<option value="carbs">Mais carboidratos</option>
					</select>
				</div>
			</div>
			{loading && <p className="text-muted">A carregar alimentos…</p>}
			{error && <p className="text-muted" style={{ color: 'var(--danger)' }}>{error}</p>}
			{!loading && !normalized.length && <p className="text-muted">Não existem alimentos para mostrar.</p>}
			<div className="card-grid cols-3" style={{ marginTop: '1.5rem' }}>
				{normalized.map((food) => (
					<article key={food.id} className="app-card food-card">
						<header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
							<div>
								<p className="stat-chip">Alimento</p>
								<h3 style={{ margin: '0.25rem 0 0' }}>{food.name}</h3>
							</div>
							<span className="tag">{food.carbs_per_100g} g HC / 100 g</span>
						</header>
						{food.image_url && (
							<img src={food.image_url} alt={food.name} />
						)}
						<p className="text-muted" style={{ marginTop: '1rem' }}>
							Atualizado em {new Date(food.updated_at).toLocaleString('pt-PT')}
						</p>
					</article>
				))}
			</div>
		</section>
	);
};

export default CatalogoAlimentos;