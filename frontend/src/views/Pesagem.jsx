import { useEffect, useMemo, useRef, useState } from 'react';
import { cacheClear, cacheGet, cacheSet } from '../utils/cache.js';

const API_URL = 'http://127.0.0.1:8000/api/v1';
const DEVICE_ID = 1;
const USER_ID = 1;
const AUTO_WINDOW_SECONDS = 10;
const HISTORY_STORAGE_KEY = 'pesagemHistory';
const FOODS_CACHE_KEY = 'cache:foods';
const FOODS_CACHE_TTL = 5 * 60 * 1000;
const HISTORY_CACHE_KEY = `cache:history:${USER_ID}`;

const getJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
};

export default function Pesagem() {
  const [foods, setFoods] = useState([]);
  const [selectedFoodId, setSelectedFoodId] = useState(null);
  const [foodQuery, setFoodQuery] = useState('');
  const [manualWeight, setManualWeight] = useState('');
  const [currentWeight, setCurrentWeight] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tareLoading, setTareLoading] = useState(false);

  const [confirmedMeasurements, setConfirmedMeasurements] = useState([]);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoMeasurement, setAutoMeasurement] = useState(null);
  const [autoAccepted, setAutoAccepted] = useState(false);
  const [lastCheckedId, setLastCheckedId] = useState(null);
  const manualMeasurementIds = useRef(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setConfirmedMeasurements(parsed);
          if (parsed.length) {
            setLastCheckedId(parsed[0]?.id ?? null);
          }
        }
      }
    } catch (error) {
      console.warn('Não foi possível carregar o histórico local:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (confirmedMeasurements.length) {
        window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(confirmedMeasurements));
      } else {
        window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      }
    } catch (error) {
      console.warn('Não foi possível guardar o histórico local:', error);
    }
  }, [confirmedMeasurements]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const cachedFoods = cacheGet(FOODS_CACHE_KEY);
    if (Array.isArray(cachedFoods) && cachedFoods.length) {
      setFoods(cachedFoods);
    }

    const loadFoods = async () => {
      try {
        const data = await getJson(`${API_URL}/foods/`, { signal: controller.signal });
        const results = Array.isArray(data) ? data : data.results ?? [];
        if (isMounted) {
          setFoods(results);
        }
        cacheSet(FOODS_CACHE_KEY, results, FOODS_CACHE_TTL);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Erro ao buscar alimentos:', error);
      }
    };

    loadFoods();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchWeight = async () => {
      try {
        const data = await getJson(`${API_URL}/devices/${DEVICE_ID}/current_weight/`);
        if (isMounted) {
          setCurrentWeight(data.current_weight_g ?? data.weight_g ?? 0);
        }
      } catch (error) {
        console.error('Erro ao buscar peso atual:', error);
      }
    };

    fetchWeight();
    const interval = setInterval(fetchWeight, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const checkNewMeasurements = async () => {
      try {
        const data = await getJson(`${API_URL}/measurements/latest/?user_id=${USER_ID}`);
        if (!data?.id || data.id === lastCheckedId) return;

        if (manualMeasurementIds.current.has(data.id)) {
          manualMeasurementIds.current.delete(data.id);
          setLastCheckedId(data.id);
          return;
        }

        const createdAt = new Date(data.measured_at);
        const secondsAgo = (Date.now() - createdAt.getTime()) / 1000;
        if (secondsAgo <= AUTO_WINDOW_SECONDS) {
          setAutoMeasurement(data);
          setAutoAccepted(false);
          setShowAutoModal(true);
        }
        setLastCheckedId(data.id);
      } catch (error) {
        console.error('Erro ao verificar medições:', error);
      }
    };

    checkNewMeasurements();
    const interval = setInterval(checkNewMeasurements, 3000);
    return () => clearInterval(interval);
  }, [lastCheckedId]);

  const handleFoodSelect = (foodId) => {
    const parsedId = Number(foodId);
    setSelectedFoodId(Number.isNaN(parsedId) ? null : parsedId);
  };

  const handleManualSubmit = async () => {
    if (!manualWeight || !selectedFoodId) {
      alert('Seleciona um alimento e introduz o peso!');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/ingest/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: DEVICE_ID,
          user_id: USER_ID,
          food_id: selectedFoodId,
          weight_g: parseFloat(manualWeight),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }

      const result = await response.json();
      manualMeasurementIds.current.add(result.id);
      const resolvedFood = foods.find((food) => food.id === selectedFoodId) ?? null;
      addMeasurementToHistory({ ...result, food: resolvedFood, food_id: selectedFoodId });
      setManualWeight('');
    } catch (error) {
      console.error('Erro ao calcular dose:', error);
      alert('Não foi possível calcular a dose.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentWeight = () => {
    setManualWeight(currentWeight.toFixed(1));
  };

  const handleAcceptAuto = () => {
    addMeasurementToHistory(autoMeasurement);
    setAutoAccepted(true);
  };

  const handleRejectAuto = () => {
    setShowAutoModal(false);
    setAutoMeasurement(null);
    setAutoAccepted(false);
  };

  const handleCloseAutoModal = () => {
    setShowAutoModal(false);
    setAutoMeasurement(null);
    setAutoAccepted(false);
  };

  const addMeasurementToHistory = (measurement) => {
    if (!measurement) return;
    const normalized = {
      ...measurement,
      food: measurement.food ?? null,
    };
    setConfirmedMeasurements((previous) => {
      const filtered = previous.filter((entry) => entry.id !== normalized.id);
      return [normalized, ...filtered];
    });
    cacheClear(HISTORY_CACHE_KEY);
  };

  const handleResetHistory = () => {
    const shouldReset =
      typeof window === 'undefined' || !confirmedMeasurements.length
        ? true
        : window.confirm('Queres limpar as medições desta sessão?');
    if (!shouldReset) return;
    setConfirmedMeasurements([]);
    manualMeasurementIds.current.clear();
  };

  const formatDecimal = (value, fractionDigits = 1) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric.toFixed(fractionDigits);
    }
    return value ?? '—';
  };

  const formatMeasurementTime = (value) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.warn('Não foi possível formatar a data da medição:', error);
      return value;
    }
  };

  const filteredFoods = useMemo(() => {
    const text = foodQuery.trim().toLowerCase();
    if (!text) return foods;
    return foods.filter((food) => food.name.toLowerCase().includes(text));
  }, [foods, foodQuery]);

  const selectedFood = useMemo(() => {
    if (!selectedFoodId) return null;
    return foods.find((food) => food.id === selectedFoodId) ?? null;
  }, [foods, selectedFoodId]);

  const sessionTotalDose = useMemo(() => {
    return confirmedMeasurements.reduce((total, entry) => {
      const numeric = Number(entry?.dose_total_units ?? 0);
      return total + (Number.isFinite(numeric) ? numeric : 0);
    }, 0);
  }, [confirmedMeasurements]);

  const handleTareRequest = async () => {
    if (tareLoading) return;
    setTareLoading(true);
    setManualWeight('');
    setCurrentWeight(0);
    try {
      const response = await fetch(`${API_URL}/devices/${DEVICE_ID}/request_tare/`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.detail || 'Falha ao pedir tara.');
      }
    } catch (error) {
      console.error('Erro ao requisitar tara:', error);
      alert('Não foi possível reiniciar a balança.');
    } finally {
      setTareLoading(false);
    }
  };

  return (
    <section>
      <div className="section-heading">
        <h2>Pesagem</h2>
        <p>Consulta a balança em tempo real, confirma medições automáticas ou calcula manualmente a dose ideal.</p>
      </div>

      {confirmedMeasurements.length > 0 && (
        <div className="app-card">
          <div className="card-header" style={{ alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div>
              <p className="stat-chip">Histórico desta sessão</p>
              <h3 style={{ margin: '0.35rem 0 0' }}>
                {confirmedMeasurements.length === 1
                  ? '1 medição confirmada'
                  : `${confirmedMeasurements.length} medições confirmadas`}
              </h3>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <p className="stat-chip">Total de unidades</p>
              <p className="metric-title" style={{ margin: '0.35rem 0 0', fontWeight: 600 }}>
                {formatDecimal(sessionTotalDose, 2)} U
              </p>
            </div>
            <button type="button" className="secondary-btn" onClick={handleResetHistory}>
              Reiniciar histórico
            </button>
          </div>
          <div
            className="history-list"
            style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
          >
            {confirmedMeasurements.map((measurement, index) => (
              <div
                key={measurement.id ?? `${measurement.measured_at}-${index}`}
                className="window-card"
                style={{ padding: '0.85rem 1rem' }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <p className="stat-chip">{index === 0 ? 'Mais recente' : `Registo ${index + 1}`}</p>
                    <h4 style={{ margin: '0.25rem 0 0' }}>{measurement.food?.name ?? '—'}</h4>
                    <p className="text-muted" style={{ marginTop: '0.2rem' }}>
                      {formatMeasurementTime(measurement.measured_at)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        minWidth: '120px',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.75rem',
                        background: 'var(--surface-muted)',
                      }}
                    >
                      <p className="text-muted" style={{ marginBottom: '0.1rem', fontSize: '0.85rem' }}>
                        Peso
                      </p>
                      <strong>{formatDecimal(measurement.weight_g)} g</strong>
                    </div>
                    <div
                      style={{
                        minWidth: '120px',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.75rem',
                        background: 'var(--surface-muted)',
                      }}
                    >
                      <p className="text-muted" style={{ marginBottom: '0.1rem', fontSize: '0.85rem' }}>
                        Hidratos
                      </p>
                      <strong>{formatDecimal(measurement.carbs_estimated_g)} g</strong>
                    </div>
                    <div
                      style={{
                        minWidth: '120px',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.75rem',
                        background: 'var(--surface-muted)',
                      }}
                    >
                      <p className="text-muted" style={{ marginBottom: '0.1rem', fontSize: '0.85rem' }}>
                        Dose total
                      </p>
                      <strong>{formatDecimal(measurement.dose_total_units)} U</strong>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-grid cols-2">
        <article className="app-card">
          <div className="card-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="stat-chip">Peso em tempo real</p>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleTareRequest}
              disabled={tareLoading}
            >
              {tareLoading ? 'A reiniciar…' : 'Resetar balança'}
            </button>
          </div>
          <div className="stat-value" style={{ fontFamily: 'monospace', fontSize: '3rem' }}>
            {currentWeight.toFixed(1)} g
          </div>
          <p className="text-muted" style={{ marginTop: '0.5rem' }}>
            Atualizado automaticamente pela balança
          </p>
          {selectedFood && (
            <div className="window-card" style={{ marginTop: '1rem' }}>
              <p className="stat-chip">Alimento selecionado</p>
              <p className="metric-title" style={{ margin: '0.35rem 0 0' }}>{selectedFood.name}</p>
              <p className="text-muted" style={{ marginTop: '0.35rem' }}>
                {selectedFood.carbs_per_100g} g HC / 100 g
              </p>
            </div>
          )}
        </article>

        <article className="app-card">
          <p className="stat-chip">Passo 1</p>
          <h3 style={{ marginTop: '0.35rem' }}>Introduz o peso para calcular</h3>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="manual-weight">Peso em gramas</label>
            <input
              id="manual-weight"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="Ex.: 135.4"
              value={manualWeight}
              onChange={(event) => setManualWeight(event.target.value)}
            />
          </div>
          <div className="wizard-weight" style={{ marginTop: '1rem' }}>
            <button type="button" className="secondary-btn" onClick={handleUseCurrentWeight}>
              Usar peso atual
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={handleManualSubmit}
              disabled={loading || !selectedFoodId}
            >
              {loading ? 'A calcular…' : 'Calcular dose'}
            </button>
          </div>
          <p className="text-muted" style={{ marginTop: '0.75rem' }}>
            Seleciona um alimento no passo seguinte para ativar o cálculo.
          </p>
        </article>
      </div>

      <div className="app-card">
        <div className="card-header">
          <div>
            <p className="stat-chip">Passo 2</p>
            <h3 style={{ margin: '0.35rem 0 0' }}>Escolhe o alimento</h3>
          </div>
          <div className="field" style={{ maxWidth: '260px', marginTop: 0 }}>
            <label htmlFor="food-search">Procurar</label>
            <input
              id="food-search"
              type="search"
              placeholder="Filtra por nome"
              value={foodQuery}
              onChange={(event) => setFoodQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="card-grid cols-3" style={{ marginTop: '1rem' }}>
          {filteredFoods.map((food) => {
            const isSelected = selectedFoodId === food.id;
            return (
              <button
                key={food.id}
                type="button"
                className="window-card"
                onClick={() => handleFoodSelect(food.id)}
                style={{
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderColor: isSelected ? 'var(--primary)' : undefined,
                  background: isSelected ? 'var(--primary-soft)' : undefined,
                  color: isSelected ? 'var(--primary)' : undefined,
                }}
              >
                <p className="stat-chip">{food.carbs_per_100g} g HC / 100 g</p>
                <p className="metric-title" style={{ marginTop: '0.5rem' }}>{food.name}</p>
                {isSelected && (
                  <p className="text-muted" style={{ marginTop: '0.35rem' }}>
                    Selecionado
                  </p>
                )}
              </button>
            );
          })}
          {!filteredFoods.length && (
            <p className="text-muted" style={{ gridColumn: '1 / -1' }}>
              Nenhum alimento corresponde ao termo pesquisado.
            </p>
          )}
        </div>
      </div>

      {showAutoModal && autoMeasurement && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Medição automática detectada</h2>
            </div>
            <div className="modal-body">
              <p>
                Recebemos uma medição automática nos últimos {AUTO_WINDOW_SECONDS} segundos. Pretendes utilizá-la?
              </p>
              <div className="window-card" style={{ marginTop: '1rem' }}>
                <p className="stat-chip">Resumo</p>
                <p className="metric-title" style={{ margin: '0.35rem 0 0' }}>{autoMeasurement.food?.name ?? '—'}</p>
                <p className="text-muted" style={{ marginTop: '0.35rem' }}>
                  Peso: {autoMeasurement.weight_g} g · Hidratos: {autoMeasurement.carbs_estimated_g} g
                </p>
                <p className="text-muted">Dose total: {autoMeasurement.dose_total_units} U</p>
              </div>
              {autoAccepted && (
                <div className="window-card" style={{ marginTop: '1rem', borderColor: 'var(--success)' }}>
                  <p className="stat-chip">Dose confirmada</p>
                  <p className="metric-title" style={{ margin: '0.35rem 0 0', color: 'var(--success)' }}>
                    {autoMeasurement.dose_total_units} U
                  </p>
                  <p className="text-muted" style={{ marginTop: '0.35rem' }}>
                    Registámos esta medição no topo da página.
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              {autoAccepted ? (
                <button type="button" className="primary-btn" onClick={handleCloseAutoModal}>
                  Fechar
                </button>
              ) : (
                <>
                  <button type="button" className="btn-secondary" onClick={handleRejectAuto}>
                    Não, fazer manualmente
                  </button>
                  <button type="button" className="btn-success" onClick={handleAcceptAuto}>
                    Sim, usar esta medição
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
