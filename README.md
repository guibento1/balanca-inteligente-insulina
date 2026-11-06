# 🏥 Balança Inteligente para Cálculo de Insulina

Sistema automático que calcula dose de insulina a partir do peso de alimentos.

---

## 🛠️ Ferramentas Utilizadas

### 🔧 Hardware
- **Raspberry Pi 3** - Computador embebido
- **HX711** - Conversor analógico-digital (ADC)
- **Load Cell** - Célula de carga

### 💻 Backend
- **Python 3** - Linguagem principal
- **Django** - Framework web
- **Django REST Framework** - API REST
- **PostgreSQL** - Base de dados
- **Azure VM** - Servidor na cloud

### 🎨 Frontend
- **React** - Framework JavaScript
- **HTTP/JSON** - Comunicação com API

---

## 🏗️ Arquitetura

```
Frontend (React)  →  API Django (Azure VM)  ↔  Raspberry Pi 3
                           ↓
                      PostgreSQL
```
