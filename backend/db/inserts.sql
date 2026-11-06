-- ============================================================================
-- DADOS DE EXEMPLO
-- ============================================================================

-- Alimentos (valores nutricionais reais - fonte: APDP, DGS)
INSERT INTO food (name, carbs_per_100g, image_url) VALUES
  ('Banana', 26.70, NULL),
  ('Maçã', 15.70, NULL),
  ('Laranja', 10.80, NULL),
  ('Morango', 6.54, NULL),
  ('Uvas', 13.70, NULL),
  ('Kiwi', 12.70, NULL),
  ('Pera', 14.00, NULL),
  ('Melancia', 6.52, NULL),
  ('Melão', 5.70, NULL),
  ('Manga', 16.00, NULL),
  ('Ananás', 11.60, NULL),
  ('Tangerina', 9.54, NULL),
  ('Pêssego', 10.10, NULL),
  ('Ameixa', 11.42, NULL),
  ('Cerejas', 12.18, NULL);

-- Utilizador de teste
INSERT INTO app_user (username) VALUES
  ('joao_silva');

-- Perfil clínico (FSI = 60 mg/dL por 1U)
INSERT INTO profile (user_id, name, sensitivity_factor) VALUES
  (1, 'Perfil João', 60.00);

-- Padrões diários: rácio I:HC por período do dia
INSERT INTO profile_icr_window (profile_id, start_time, end_time, grams_per_unit, target_min_mgdl, target_max_mgdl) VALUES
  (1, '07:00', '09:59', 27.00, 80, 120),
  (1, '10:00', '11:59', 32.00, 80, 120),
  (1, '12:00', '14:59', 34.00, 80, 120),
  (1, '15:00', '19:59', 28.00, 80, 140),
  (1, '20:00', '06:59', 24.00, 80, 120);

-- Dispositivo
INSERT INTO device (device_name, user_id, current_food_id) VALUES
  ('Raspberry Pi - Cozinha', 1, NULL);
