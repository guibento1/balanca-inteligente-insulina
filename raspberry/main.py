"""
main.py
Ciclo principal do sistema
"""

import time
import threading
from balanca import Balanca
from api_client import get_api_config, send_measurement, confirm_tare_request
from weight_streamer import stream_weight
from config import POLL_INTERVAL, WEIGHT_THRESHOLD, STABLE_READINGS

def main():
    print("\n" + "="*60)
    print("  BALANCA INTELIGENTE - Raspberry Pi 3B")
    print("="*60 + "\n")
    
    # Inicializar balanca
    try:
        balanca = Balanca()
    except Exception as e:
        print(f"FALHA CRITICA: {e}")
        return
    
    # Iniciar thread para enviar peso em tempo real
    weight_thread = threading.Thread(
        target=stream_weight,
        args=(balanca,),
        daemon=True
    )
    weight_thread.start()
    
    print("Sistema pronto. Peso em tempo real ativo.\n")
    
    # Estado para detetar peso estavel
    ultimo_peso = 0
    contador_estavel = 0
    ja_calculou = False
    
    try:
        while True:
            # LOOP: obter config atual (food, pending_tare)
            config = get_api_config()

            # Sem config: aguardar e tentar novamente
            if not config:
                print("Sem config da API. A tentar novamente em 5s...")
                time.sleep(5)
                continue

            # pending_tare: executar tara, notificar API e resetar estados locais
            if config.get('pending_tare'):
                print("\nPedido de tara recebido. A zerar a balança...")
                balanca.tara()
                confirm_tare_request()
                ultimo_peso = 0
                contador_estavel = 0
                ja_calculou = False
                time.sleep(1)
                continue

            # Ler peso atual
            peso = balanca.ler_peso()

            # Mostrar peso (terminal)
            print(f"Peso: {peso:7.1f} g  [{config['food']['name']}]", end='\r')

            # Verificar estabilidade: diferença <2 -> incrementar, senão resetar
            if abs(peso - ultimo_peso) < 2:
                contador_estavel += 1
            else:
                contador_estavel = 0
                ja_calculou = False

            ultimo_peso = peso

            # Se peso > limiar e estável, enviar medição (evitar duplicados com ja_calculou)
            if peso > WEIGHT_THRESHOLD and contador_estavel >= STABLE_READINGS and not ja_calculou:
                print("\n\nPeso estavel detetado! A enviar medicao...\n")
                if send_measurement(config, peso):
                    ja_calculou = True
                    print("Retira o alimento para nova medicao...\n")
                    time.sleep(2)

            # Pausa curta entre leituras
            time.sleep(0.5)
    
    except KeyboardInterrupt:
        print("\n\nSistema interrompido.")
    
    except Exception as e:
        print(f"\nERRO: {e}")
    
    finally:
        balanca.limpar()
        print("Sistema encerrado.\n")

if __name__ == "__main__":
    main()
