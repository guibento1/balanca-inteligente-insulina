"""
config.py
Configuracoes do projeto (pinos GPIO, API URL, etc)
"""

import os
from dotenv import load_dotenv

# Carregar variaveis de ambiente do ficheiro .env (se existir)
load_dotenv()

# ==================== API DJANGO ====================
API_URL = os.getenv('API_URL', 'http://localhost:8000/api/v1')
DEVICE_ID = int(os.getenv('DEVICE_ID', 1))

# ==================== PINOS GPIO (BCM) ====================
HX711_DATA_PIN = int(os.getenv('HX711_DATA_PIN', 5))
HX711_SCK_PIN = int(os.getenv('HX711_SCK_PIN', 6))

# ==================== CALIBRACAO ====================
REFERENCE_UNIT = float(os.getenv('REFERENCE_UNIT', 40.712876427830004))
# Nota: Comeca com 1, depois calibra com peso conhecido

# ==================== CONFIGURACOES DE POLLING ====================
POLL_INTERVAL = int(os.getenv('POLL_INTERVAL', 5))  # Segundos entre pedidos a API
WEIGHT_THRESHOLD = 10  # Gramas minimas para considerar que ha algo na balanca
STABLE_READINGS = 3    # Quantas leituras seguidas iguais = peso estavel
