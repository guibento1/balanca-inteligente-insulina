-- ============================================================================
-- BD Projeto de SE
-- ============================================================================

-- Catálogo de alimentos
CREATE TABLE food (
  food_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  carbs_per_100g NUMERIC(6,2) NOT NULL CHECK (carbs_per_100g >= 0 AND carbs_per_100g <= 100),
  image_url VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_food_name ON food(name);


-- Utilizador do sistema
CREATE TABLE app_user (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- Parâmetros clínicos do utilizador
CREATE TABLE profile (
  profile_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  name VARCHAR(100) DEFAULT 'Perfil Principal',
  sensitivity_factor NUMERIC(8,2) NOT NULL CHECK (sensitivity_factor > 0),  -- mg/dL por 1U
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);


-- Rácio I:HC por intervalo horário
CREATE TABLE profile_icr_window (
  window_id SERIAL PRIMARY KEY,
  profile_id INT NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grams_per_unit NUMERIC(6,2) NOT NULL CHECK (grams_per_unit > 0),  -- gramas HC por 1U
  target_min_mgdl INT NOT NULL CHECK (target_min_mgdl > 0 AND target_min_mgdl < 300),  -- meta glicémica mínima
  target_max_mgdl INT NOT NULL CHECK (target_max_mgdl > target_min_mgdl AND target_max_mgdl <= 300),  -- meta glicémica máxima
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, start_time, end_time)
);

CREATE INDEX idx_icr_profile_time ON profile_icr_window(profile_id, start_time, end_time);


-- Dispositivo embebido (Raspberry PI + balança)
CREATE TABLE device (
  device_id SERIAL PRIMARY KEY,
  device_name VARCHAR(100) DEFAULT 'Raspberry Pi',
  user_id INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  current_food_id INT REFERENCES food(food_id) ON DELETE SET NULL,
  current_weight_g NUMERIC(10,3) DEFAULT NULL CHECK (current_weight_g IS NULL OR current_weight_g >= 0),
  pending_tare BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  battery_level NUMERIC(4,2) CHECK (battery_level >= 0 AND battery_level <= 100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_user ON device(user_id);


-- Medições e cálculos de dose de insulina
CREATE TABLE measurement (
  measurement_id SERIAL PRIMARY KEY,
  device_id INT NOT NULL REFERENCES device(device_id) ON DELETE RESTRICT,
  food_id INT NOT NULL REFERENCES food(food_id) ON DELETE RESTRICT,
  profile_id INT NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  weight_g NUMERIC(10,3) NOT NULL CHECK (weight_g > 0),
  carbs_estimated_g NUMERIC(10,3) NOT NULL CHECK (carbs_estimated_g >= 0),
  dose_carbs_units NUMERIC(10,3) NOT NULL CHECK (dose_carbs_units >= 0),  -- dose para carboidratos
  dose_correction_units NUMERIC(10,3) DEFAULT 0 CHECK (dose_correction_units >= 0),  -- dose de correção
  dose_total_units NUMERIC(10,3) NOT NULL CHECK (dose_total_units >= 0),
  measured_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  params_snapshot JSONB  -- snapshot dos parâmetros usados no cálculo
);

CREATE INDEX idx_meas_device_time ON measurement(device_id, measured_at DESC);
CREATE INDEX idx_meas_food_time ON measurement(food_id, measured_at DESC);
CREATE INDEX idx_meas_profile_time ON measurement(profile_id, measured_at DESC);
CREATE INDEX idx_meas_created ON measurement(created_at DESC);