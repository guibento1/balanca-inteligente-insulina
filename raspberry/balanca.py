"""
balanca.py
Classe para HX711 com GAIN 128
"""

from hx711 import HX711
import RPi.GPIO as GPIO
import time
from config import HX711_DATA_PIN, HX711_SCK_PIN, REFERENCE_UNIT

class Balanca:
    def __init__(self):
        print("A iniciar balanca...")
        
        try:
            self.hx = HX711(HX711_DATA_PIN, HX711_SCK_PIN)
            
            # Configurado com GAIN 128
            self.hx.set_gain(128)
            
            # Definir unidade de referencia
            self.hx.set_reference_unit(REFERENCE_UNIT)
            
            # Reiniciar e aguardar estabilizacao
            self.hx.reset()
            time.sleep(1)
            
            # Tara (zerar)
            print("A zerar balanca (TARA)... Nao coloques nada em cima!")
            self.hx.tare()
            
            print("Balanca pronta!\n")
            
        except Exception as e:
            print(f"ERRO ao inicializar balanca: {e}")
            raise
    
    def ler_peso(self):
        """Le o peso em gramas"""
        try:
            # Ler peso (media de 15 leituras)
            peso = self.hx.get_weight(15)
            
            # Converter e arredondar
            peso = round(float(peso), 1)
            
            # Retornar apenas valores positivos
            return max(0.0, peso)
            
        except Exception as e:
            return 0.0
    
    def tara(self):
        """Zera a balanca"""
        try:
            print("A zerar balanca...")
            self.hx.tare()
            print("Balanca zerada.")
        except Exception as e:
            print(f"Erro ao fazer tara: {e}")
    
    def limpar(self):
        """Limpa os pinos GPIO"""
        try:
            GPIO.cleanup()
            print("GPIO limpo.")
        except Exception as e:
            pass
