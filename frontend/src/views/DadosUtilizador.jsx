import { useEffect, useState } from 'react';
import api from '../services/axios.js';
import { useUser } from '../context/UserContext.jsx';
import { cacheGet, cacheSet } from '../utils/cache.js';

const emptyWindow = () => ({
	id: undefined,
	start_time: '00:00',
	end_time: '06:00',
	grams_per_unit: '15.0',
	target_min_mgdl: 90,
	target_max_mgdl: 140,
});

const PROFILE_CACHE_PREFIX = 'cache:profile:';
const PROFILE_CACHE_TTL = 10 * 60 * 1000;

const buildFormState = (data) => {
	const windowsSource = data?.icr_windows?.length ? data.icr_windows : [emptyWindow()];
	return {
		name: data?.name ?? '',
		sensitivity_factor: data?.sensitivity_factor ?? '',
		icr_windows: windowsSource.map((window) => ({ ...window })),
	};
};

const DadosUtilizador = () => {
	const { user, refreshUser } = useUser();
	const [profile, setProfile] = useState(null);
	const [formState, setFormState] = useState(buildFormState(null));
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState(null);
	const profileCacheKey = user?.id ? `${PROFILE_CACHE_PREFIX}${user.id}` : null;

	useEffect(() => {
		if (!user?.id) {
			setProfile(null);
			setFormState(buildFormState(null));
			setLoading(false);
			return;
		}

		let isMounted = true;
		const controller = new AbortController();
		const cachedProfile = profileCacheKey ? cacheGet(profileCacheKey) : null;
		if (cachedProfile) {
			setProfile(cachedProfile);
			setFormState(buildFormState(cachedProfile));
			setLoading(false);
		} else {
			setLoading(true);
		}
		setMessage(null);

		const fetchProfile = async () => {
			try {
				const { data } = await api.get(`users/${user.id}/profile/`, { signal: controller.signal });
				if (!isMounted) return;
				setProfile(data);
				setFormState(buildFormState(data));
				setLoading(false);
				if (profileCacheKey) {
					cacheSet(profileCacheKey, data, PROFILE_CACHE_TTL);
				}
			} catch (error) {
				if (controller.signal.aborted) return;
				console.error(error);
				if (!cachedProfile) {
					setMessage('Não foi possível carregar os dados do utilizador.');
					setProfile(null);
					setFormState(buildFormState(null));
				}
				setLoading(false);
			}
		};

		fetchProfile();

		return () => {
			isMounted = false;
			controller.abort();
		};
	}, [user?.id, profileCacheKey]);

	const updateWindow = (index, field, value) => {
		setFormState((prev) => {
			const updated = prev.icr_windows.map((window, idx) =>
				idx === index ? { ...window, [field]: value } : window,
			);
			return { ...prev, icr_windows: updated };
		});
	};

	const addWindow = () => {
		setFormState((prev) => ({
			...prev,
			icr_windows: [...prev.icr_windows, emptyWindow()],
		}));
	};

	const removeWindow = (index) => {
		setFormState((prev) => ({
			...prev,
			icr_windows: prev.icr_windows.filter((_, idx) => idx !== index),
		}));
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		if (!user) return;
		setSaving(true);
		setMessage(null);
		try {
			const payload = {
				name: formState.name,
				sensitivity_factor: formState.sensitivity_factor,
				icr_windows: formState.icr_windows,
			};
			const { data } = await api.put(`users/${user.id}/profile/`, payload);
			setProfile(data);
			if (profileCacheKey) {
				cacheSet(profileCacheKey, data, PROFILE_CACHE_TTL);
			}
			setMessage('Perfil atualizado com sucesso.');
			refreshUser();
		} catch (error) {
			console.error(error);
			setMessage('Erro ao guardar as alterações.');
		} finally {
			setSaving(false);
		}
	};

	if (!user) {
		return <p className="text-muted">Selecione um utilizador para ver os dados clínicos.</p>;
	}

	if (loading) {
		return <p className="text-muted">A carregar perfil…</p>;
	}

	return (
		<section>
			<div className="section-heading">
				<h2>Dados clínicos</h2>
				<p>Atualize parâmetros utilizados pela Raspberry Pi nos cálculos.</p>
			</div>
			<form onSubmit={handleSubmit} className="app-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
				<div className="form-grid cols-2">
					<div className="field">
						<label>Nome do perfil</label>
						<input
							type="text"
							value={formState.name}
							onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
						/>
					</div>
					<div className="field">
						<label>Fator de sensibilidade (mg/dL por 1U)</label>
						<input
							type="number"
							step="0.01"
							value={formState.sensitivity_factor}
							onChange={(event) =>
								setFormState((prev) => ({ ...prev, sensitivity_factor: event.target.value }))
							}
						/>
					</div>
				</div>

				<div>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<h3 style={{ margin: 0 }}>Janelas I:HC</h3>
						<button type="button" className="secondary-btn" onClick={addWindow}>
							Adicionar janela
						</button>
					</div>
					<div className="window-grid">
						{formState.icr_windows.map((window, index) => (
							<div key={window.id ?? index} className="window-card">
								<div className="form-grid cols-3">
									<div className="field">
										<label>Início</label>
										<input
											type="time"
											value={window.start_time}
											onChange={(event) => updateWindow(index, 'start_time', event.target.value)}
										/>
									</div>
									<div className="field">
										<label>Fim</label>
										<input
											type="time"
											value={window.end_time}
											onChange={(event) => updateWindow(index, 'end_time', event.target.value)}
										/>
									</div>
									<div className="field">
										<label>g HC / 1U</label>
										<input
											type="number"
											step="0.1"
											value={window.grams_per_unit}
											onChange={(event) => updateWindow(index, 'grams_per_unit', event.target.value)}
										/>
									</div>
								</div>
								<div className="form-grid cols-3">
									<div className="field">
										<label>Meta min (mg/dL)</label>
										<input
											type="number"
											value={window.target_min_mgdl}
											onChange={(event) => updateWindow(index, 'target_min_mgdl', Number(event.target.value))}
										/>
									</div>
									<div className="field">
										<label>Meta máx (mg/dL)</label>
										<input
											type="number"
											value={window.target_max_mgdl}
											onChange={(event) => updateWindow(index, 'target_max_mgdl', Number(event.target.value))}
										/>
									</div>
									<div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
										<button type="button" className="secondary-btn" onClick={() => removeWindow(index)}>
											Remover
										</button>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>

				{message && <p className="text-muted" style={{ color: message.includes('Erro') ? 'var(--danger)' : undefined }}>{message}</p>}

				<div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
					<button type="submit" disabled={saving} className="primary-btn">
						{saving ? 'A guardar…' : 'Guardar alterações'}
					</button>
					<button type="button" className="secondary-btn" onClick={() => window.location.reload()}>
						Repor
					</button>
				</div>
			</form>
		</section>
	);
};

export default DadosUtilizador;
