"""
Script de prueba para la API de Colas WhatsApp
Ejecutar: python test_api.py
"""
import requests
import time
import json

BASE_URL = "http://localhost:8001"

print("🧪 Iniciando pruebas de API WhatsApp Queue\n")

# 1. Verificar que la API esté activa
print("1️⃣ Verificando estado de la API...")
try:
    response = requests.get(f"{BASE_URL}/health")
    print(f"   ✅ API activa: {response.json()}")
except Exception as e:
    print(f"   ❌ Error: {e}")
    exit(1)

# 2. Crear campaña con archivo CSV
print("\n2️⃣ Creando campaña de prueba...")
try:
    with open('test_prueba.csv', 'rb') as f:
        files = {'file': ('test_prueba.csv', f, 'text/csv')}
        data = {
            'titulo_campana': 'test_001',
            'plantilla': 'servicio_suspendido',
            'buzon': '14',
            'idioma': 'es'
        }
        response = requests.post(f"{BASE_URL}/api/crear-campana", files=files, data=data)
        result = response.json()
        
        if result.get('success'):
            print(f"   ✅ Campaña creada exitosamente")
            print(f"      - ID: {result.get('campaign_id')}")
            print(f"      - Mensajes: {result.get('total_messages')}")
            print(f"      - En cola: {result.get('queued')}")
            campaign_id = result.get('campaign_id')
        else:
            print(f"   ❌ Error: {result}")
            exit(1)
except Exception as e:
    print(f"   ❌ Error: {e}")
    exit(1)

# 3. Esperar un poco para que el worker procese
print("\n3️⃣ Esperando procesamiento del worker (5 segundos)...")
time.sleep(5)

# 4. Consultar estado de la cola
print("\n4️⃣ Consultando estado de la campaña...")
try:
    response = requests.get(f"{BASE_URL}/api/estado-cola/{campaign_id}")
    estado = response.json()
    
    print(f"   📊 Estado de la campaña '{campaign_id}':")
    print(f"      - Pendientes: {estado.get('pendientes', 0)}")
    print(f"      - Procesados: {estado.get('procesados', 0)}")
    print(f"      - Exitosos: {estado.get('exitosos', 0)}")
    print(f"      - Fallidos: {estado.get('fallidos', 0)}")
    print(f"      - Total: {estado.get('total', 0)}")
    
except Exception as e:
    print(f"   ❌ Error: {e}")

# 5. Listar todas las campañas
print("\n5️⃣ Listando todas las campañas...")
try:
    response = requests.get(f"{BASE_URL}/api/listar-campanas")
    campanas = response.json()
    
    if campanas.get('success'):
        print(f"   📋 Total de campañas: {len(campanas.get('campaigns', []))}")
        for camp in campanas.get('campaigns', []):
            print(f"      - {camp}")
    else:
        print(f"   ❌ Error: {campanas}")
        
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n✨ Pruebas completadas!")
print("\n💡 Puedes ver más detalles en:")
print(f"   - Documentación interactiva: {BASE_URL}/docs")
print(f"   - Estado de una campaña: {BASE_URL}/api/estado-cola/{campaign_id}")
