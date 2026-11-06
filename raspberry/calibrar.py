"""
calibrar.py
Script de calibracao para HX711 v0.1.0
"""

from hx711 import HX711
import RPi.GPIO as GPIO
import time
import sys

print("=== CALIBRACAO HX711 ===\n")

# Inicializar HX711
hx = HX711(5, 6)
hx.set_gain(128)

# Configurar reference unit inicial = 1
hx.set_reference_unit(1)
hx.reset()

print("PASSO 1: Retira tudo da balanca")
input("Prime ENTER quando a balanca estiver vazia...")

# Fazer tara (zerar)
print("\nA fazer tara...")
hx.tare()
time.sleep(1)

# Verificar zero
print("\nA verificar zero (deve estar perto de 0):")
for i in range(3):
    valor = hx.get_weight()
    print(f"  Leitura {i+1}: {valor}")
    time.sleep(0.5)

print("\n" + "="*50)
print("PASSO 2: Coloca um peso conhecido na balanca")
print("="*50)
print("\nExemplos de pesos:")
print("  - 100g (ex: 100ml de agua)")
print("  - 200g (ex: pacote de acucar)")
print("  - 500g (ex: garrafa de agua)")
print()

peso_real = float(input("Quanto pesa o objeto (em gramas)? "))
input("Coloca o objeto na balanca e prime ENTER...")

# Ler valores com peso
print(f"\nA ler valores com {peso_real}g na balanca:")
valores = []
for i in range(10):
    valor = hx.get_weight()
    valores.append(valor)
    print(f"  Leitura {i+1}: {valor}")
    time.sleep(0.3)

# Calcular media
media = sum(valores) / len(valores)
print(f"\nMedia dos valores: {media}")

# Calcular REFERENCE_UNIT
reference_unit = media / peso_real

print("\n" + "="*50)
print("RESULTADO DA CALIBRACAO")
print("="*50)
print(f"\nREFERENCE_UNIT = {reference_unit}")
print("\nColoca este valor no ficheiro config.py:")
print(f"\n    REFERENCE_UNIT = {reference_unit}\n")
print("="*50)

# Teste com o novo valor
print("\nTeste com o novo REFERENCE_UNIT:")
hx.set_reference_unit(reference_unit)
hx.tare()
time.sleep(1)

input("\nColoca novamente o objeto na balanca e prime ENTER...")

print("\nA ler peso com calibracao:")
for i in range(5):
    peso = hx.get_weight(5)
    print(f"  Leitura {i+1}: {peso:.1f}g (esperado: {peso_real}g)")
    time.sleep(0.5)

print("\nCalibracao concluida!")
GPIO.cleanup()
