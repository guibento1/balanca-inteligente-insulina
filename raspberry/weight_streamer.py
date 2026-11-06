"""
weight_streamer.py
Envia o peso continuamente para a API (tempo real)
"""

import requests
import time
from config import API_URL, DEVICE_ID

def stream_weight(balanca):
    """
    Envia o peso atual para a API a cada 0.5s
    Nao cria medicao, so atualiza o campo temporario
    """
    while True:
        try:
            peso = balanca.ler_peso()
            
            # Enviar peso para API
            url = f"{API_URL}/devices/{DEVICE_ID}/update_weight/"
            requests.post(url, json={"weight_g": peso}, timeout=5)
            
        except Exception as e:
            print(f"   Erro ao enviar peso: {e}")
        
        time.sleep(1) 
