"""
api_client.py
Funcoes para comunicar com a API Django
"""

import requests
from datetime import datetime
from config import API_URL, DEVICE_ID

def get_api_config():
    """Obtem configuracao da API (alimento + perfil)"""
    try:
        url = f"{API_URL}/devices/{DEVICE_ID}/"
        response = requests.get(url, timeout=10) 
        response.raise_for_status()
        
        device = response.json()
        
        if not device.get('current_food'):
            print("Nenhum alimento selecionado no dispositivo")
            return None
        
        if not device.get('user'):
            print("Nenhum utilizador associado ao dispositivo")
            return None
        
        # Obter perfil do utilizador
        user_id = device['user']['id']
        profile_url = f"{API_URL}/users/{user_id}/profile/"
        profile_response = requests.get(profile_url, timeout=10)  
        profile_response.raise_for_status()
        
        config = {
            'food': device['current_food'],
            'profile': profile_response.json(),
            'user_id': user_id,
            'pending_tare': device.get('pending_tare', False),
        }
        
        return config
        
    except requests.exceptions.RequestException as e:
        print(f"Erro ao obter config da API: {e}")
        return None

def send_weight_realtime(peso_g):
    """
    Envia o peso atual para a API (tempo real)
    Nao cria medicao, so atualiza o campo temporario
    """
    try:
        url = f"{API_URL}/devices/{DEVICE_ID}/update_weight/"
        response = requests.post(
            url,
            json={"weight_g": peso_g},
            timeout=10  
        )
        response.raise_for_status()
        return True
        
    except requests.exceptions.RequestException:
        # Silencioso para nao poluir terminal
        return False

def send_measurement(config, peso_g):
    """
    Envia medicao FINAL para a API (cria registo na BD)
    A API calcula automaticamente HC e dose
    """
    try:
        url = f"{API_URL}/ingest/"
        
        payload = {
            "device_id": DEVICE_ID,
            "user_id": config['user_id'],
            "food_id": config['food']['id'],
            "weight_g": peso_g,
        }
        
        response = requests.post(url, json=payload, timeout=10)  
        response.raise_for_status()
        
        result = response.json()
        
        print("Medicao enviada para a API!")
        print(f"   Peso: {peso_g}g")
        print(f"   HC: {result['carbs_estimated_g']}g")
        print(f"   Dose: {result['dose_total_units']}U")
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"Erro ao enviar medicao: {e}")
        return False

def confirm_tare_request():
    """Informa a API que a tara foi concluída."""
    try:
        url = f"{API_URL}/devices/{DEVICE_ID}/confirm_tare/"
        response = requests.post(url, timeout=10)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        print(f"Erro ao confirmar tara na API: {e}")
        return False
