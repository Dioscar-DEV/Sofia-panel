"""
Script para consultar los registros en instancias_inputs
"""
import os
from supabase import create_client

# Credenciales
SUPABASE_URL = "https://tzlmfhppbpvngzlpwqqq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6bG1maHBwYnB2bmd6bHB3cXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3Nzc5NDksImV4cCI6MjA3ODM1Mzk0OX0.A2PkWlN7UQkN7B5Inj4wSREskTK3tPLWQngr491Xm5Y"

# Crear cliente
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Consultar todos los registros
print("\n=== Consultando instancia_sofia.instancias_inputs ===\n")
result = supabase.schema("instancia_sofia").table("instancias_inputs") \
    .select("id, custom_name, nameid, canal") \
    .execute()

if result.data:
    print(f"Total de registros encontrados: {len(result.data)}\n")
    for record in result.data:
        print(f"ID: {record['id']}")
        print(f"  custom_name: '{record['custom_name']}'")
        print(f"  nameid: '{record['nameid']}'")
        print(f"  canal: {record['canal']}")
        print()
else:
    print("No se encontraron registros en la tabla")
