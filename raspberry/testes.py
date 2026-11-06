# test_gain.py
from hx711 import HX711
import time

hx = HX711(5, 6)

print("=== TESTE COM GANHOS DIFERENTES ===\n")

# Testar GAIN 128 (predefinido)
print("1. GAIN = 128 (canal A, predefinido)")
hx.set_gain(128)
time.sleep(0.5)
for i in range(3):
    valor = hx.read_long()
    print(f"   Leitura {i+1}: {valor}")
    time.sleep(0.3)

# Testar GAIN 64
print("\n2. GAIN = 64 (canal A)")
hx.set_gain(64)
time.sleep(0.5)
for i in range(3):
    valor = hx.read_long()
    print(f"   Leitura {i+1}: {valor}")
    time.sleep(0.3)

# Testar GAIN 32 (canal B)
print("\n3. GAIN = 32 (canal B)")
hx.set_gain(32)
time.sleep(0.5)
for i in range(3):
    valor = hx.read_long()
    print(f"   Leitura {i+1}: {valor}")
    time.sleep(0.3)

print("\n>>> COLOCA UM PESO NA BALANCA <<<")
input("Carrega no ENTER...")

# Testar com peso
print("\n4. COM PESO - GAIN = 128")
hx.set_gain(128)
time.sleep(0.5)
for i in range(3):
    valor = hx.read_long()
    print(f"   Leitura {i+1}: {valor}")
    time.sleep(0.3)

print("\n=== FIM ===")
print("Se algum GAIN mostrar valores diferentes de 0, esse e o correcto!")
