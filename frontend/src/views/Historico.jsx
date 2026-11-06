import { useEffect, useMemo, useState } from 'react';
import api from '../services/axios.js';
import { useUser } from '../context/UserContext.jsx';
import { cacheGet, cacheSet, cacheClear } from '../utils/cache.js';

const FOODS_CACHE_KEY = 'cache:foods';
const FOODS_CACHE_TTL = 5 * 60 * 1000;
const HISTORY_CACHE_PREFIX = 'cache:history:';
const HISTORY_CACHE_TTL = 2 * 60 * 1000;
const HISTORY_RECENT_LIMIT = 20;

const formatDate = (value) =>
	new Date(value).toLocaleString('pt-PT', {
		dateStyle: 'short',
		timeStyle: 'short',
	});

const Historico = () => {
	const { user } = useUser();
	const [measurements, setMeasurements] = useState([]);
	const [foods, setFoods] = useState([]);
	const [filters, setFilters] = useState({ food: '', minDose: '', maxDose: '' });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		if (!user?.id) return;
		let isMounted = true;
		const controller = new AbortController();
		const historyCacheKey = `${HISTORY_CACHE_PREFIX}${user.id}`;
		setError(null);

		const cachedFoods = cacheGet(FOODS_CACHE_KEY);
		if (Array.isArray(cachedFoods) && cachedFoods.length) {
			setFoods(cachedFoods);
		}

		const cachedMeasurements = cacheGet(historyCacheKey);
		const hasCachedMeasurements = Array.isArray(cachedMeasurements) && cachedMeasurements.length > 0;
		if (hasCachedMeasurements) {
			setMeasurements(cachedMeasurements);
			setLoading(false);
		} else {
			setLoading(true);
		}

		const fetchData = async () => {
			try {
				const [measurementsResponse, foodsResponse] = await Promise.all([
					api.get('measurements/recent/', {
						params: { user_id: user.id, limit: HISTORY_RECENT_LIMIT },
						signal: controller.signal,
					}),
					api.get('foods/', { signal: controller.signal }),
				]);
				const measurementsData = measurementsResponse.data;
				const measurementItems = Array.isArray(measurementsData)
					? measurementsData
					: measurementsData.results ?? [];
				const foodsPayload = foodsResponse.data;
				const foodsList = Array.isArray(foodsPayload) ? foodsPayload : foodsPayload.results ?? [];
				if (isMounted) {
					setMeasurements(measurementItems);
					setFoods(foodsList);
					setLoading(false);
				}
				cacheSet(historyCacheKey, measurementItems, HISTORY_CACHE_TTL);
				cacheSet(FOODS_CACHE_KEY, foodsList, FOODS_CACHE_TTL);
			} catch (err) {
				if (controller.signal.aborted) return;
				console.error(err);
				if (isMounted) {
					if (!hasCachedMeasurements) {
						setError('Não foi possível carregar o histórico.');
						setMeasurements([]);
					} else if (/JSON/.test(String(err?.message ?? ''))) {
						cacheClear(historyCacheKey);
					}
					setLoading(false);
				}
			}
		};

		fetchData();

		return () => {
			isMounted = false;
			controller.abort();
		};
	}, [user?.id]);

	const filteredMeasurements = useMemo(() => {
		return measurements.filter((measurement) => {
			if (filters.food && String(measurement.food?.id) !== String(filters.food)) {
				return false;
			}
			if (filters.minDose && Number(measurement.dose_total_units) < Number(filters.minDose)) {
				return false;
			}
			if (filters.maxDose && Number(measurement.dose_total_units) > Number(filters.maxDose)) {
				return false;
			}
			return true;
		});
	}, [measurements, filters]);

	const stats = useMemo(() => {
		if (!filteredMeasurements.length) {
			return { avgDose: 0, avgCarbs: 0 };
		}
		const totals = filteredMeasurements.reduce(
			(acc, item) => {
				acc.dose += Number(item.dose_total_units);
				acc.carbs += Number(item.carbs_estimated_g);
				return acc;
			},
			{ dose: 0, carbs: 0 },
		);
		return {
			avgDose: (totals.dose / filteredMeasurements.length).toFixed(2),
			avgCarbs: (totals.carbs / filteredMeasurements.length).toFixed(1),
		};
	}, [filteredMeasurements]);

	if (!user) {
		return <p>Selecione um utilizador para consultar o histórico.</p>;
	}

	return (
		<section className="space-y-6">
			<div>
				<h2 className="text-xl font-semibold text-slate-900">Histórico de medições</h2>
				<p className="text-sm text-slate-500">Filtre e consulte as doses administradas pela Raspberry Pi.</p>
			</div>

			<div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
				<div>
					<p className="text-xs uppercase tracking-wide text-slate-500">Registos</p>
					<p className="text-2xl font-bold">{filteredMeasurements.length}</p>
				</div>
				<div>
					<p className="text-xs uppercase tracking-wide text-slate-500">Dose média (U)</p>
					<p className="text-2xl font-bold">{stats.avgDose}</p>
				</div>
				<div>
					<p className="text-xs uppercase tracking-wide text-slate-500">Carboidratos médios (g)</p>
					<p className="text-2xl font-bold">{stats.avgCarbs}</p>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				<label className="text-sm font-medium text-slate-700">
					Filtrar por alimento
					<select
						value={filters.food}
						onChange={(event) => setFilters((prev) => ({ ...prev, food: event.target.value }))}
						className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
					>
						<option value="">Todos</option>
						{foods.map((food) => (
							<option key={food.id} value={food.id}>
								{food.name}
							</option>
						))}
					</select>
				</label>
				<label className="text-sm font-medium text-slate-700">
					Dose mínima (U)
					<input
						type="number"
						value={filters.minDose}
						onChange={(event) => setFilters((prev) => ({ ...prev, minDose: event.target.value }))}
						className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
					/>
				</label>
				<label className="text-sm font-medium text-slate-700">
					Dose máxima (U)
					<input
						type="number"
						value={filters.maxDose}
						onChange={(event) => setFilters((prev) => ({ ...prev, maxDose: event.target.value }))}
						className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
					/>
				</label>
			</div>

			{loading && <p>A carregar...</p>}
			{error && <p className="text-sm text-red-600">{error}</p>}

			<div className="overflow-x-auto rounded-lg border border-slate-200">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50">
						<tr>
							<th className="px-4 py-2 text-left">Data</th>
							<th className="px-4 py-2 text-left">Alimento</th>
							<th className="px-4 py-2 text-left">Dispositivo</th>
							<th className="px-4 py-2">Peso (g)</th>
							<th className="px-4 py-2">Carboidratos (g)</th>
							<th className="px-4 py-2">Dose total (U)</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{filteredMeasurements.map((item) => (
							<tr key={item.id}>
								<td className="px-4 py-2">{formatDate(item.measured_at)}</td>
								<td className="px-4 py-2">{item.food?.name}</td>
								<td className="px-4 py-2">{item.device?.device_name}</td>
								<td className="px-4 py-2 text-center">{item.weight_g}</td>
								<td className="px-4 py-2 text-center">{item.carbs_estimated_g}</td>
								<td className="px-4 py-2 text-center">{item.dose_total_units}</td>
							</tr>
						))}
						{!filteredMeasurements.length && !loading && (
							<tr>
								<td colSpan="6" className="px-4 py-6 text-center text-slate-500">
									Sem registos para os filtros aplicados.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</section>
	);
};

export default Historico;