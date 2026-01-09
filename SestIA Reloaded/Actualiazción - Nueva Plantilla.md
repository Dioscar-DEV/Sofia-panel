DOCUMENTACION DE IMPLEMENTACION:

## SUPABASE

1. Usar archivo "sql definitivo.sql" en la consola sql de supabase para generar todas las tablas necesarias

	ERRORES
	- ERROR 1: Fallo por una tabla "profiles"
		Motivo: Esto fue porque ya existía una vista con ese nombre.
		Solucion: Usar el comando "DROP VIEW IF EXISTS public.profiles CASCADE;" en la consola sql para eliminar esa vista y luego poder ejecutar el sql completo de nuevo

2. Usar los comandos sql "agent_config_rows.sql" y "input_channels_rows (1).sql"

	ERRORES
	- ERROR 1: Fallo al ejecutar los comandos por tipo de Array
		Motivo: No estaba definido formato de array (ARRAY[])
		Solucion: Definir en el sql el formato (ARRAY[]::text[],). Ya no deberia volver a pasar este error

## N8N

1. Crear los escenarios de n8n importando los archivos JSON

	1.1 Crear nuevo workflow 1
		- Importar archivo "sestia-file-processing.json" a n8n en ese nuevo workflow
		- Cambiar credenciales de nodo "Get a Row"
		- Cambiar credenciales de nodos de Open Router
		- Cambiar nombre del workflow (Opcional, depende de ti)
	1.2. Crear nuevo workflow 2
		- Importar archivo "sestia-file-save.json" a n8n en ese nuevo workflow
		- Cambiar credenciales de nodos "guarda_documento", "archivo_firmado" y "multimedia_metadata_save"
		- Cambiar nombre del workflow (Opcional, depende de ti)
	1.3. Crear nuevo workflow 3 (Este sera temporal, servira para ir pasando los nodos nuevos por partes al agente principal)
		- Importar archivo "sestia-files-instance (1).json" (Yo no lo importo porque ya lo tengo xd)
		- Cambiar nombre del workflow (Opcional, depende de ti)

2. Instalar nodo "@rmichelena/n8n-nodes-redis-enhanced"

3. Reestructurar nodos en agente principal

	3.1. Ir al agente principal a actualizar (El tuyo)
	3.2. Eliminar todos los nodos desde los INPUT hasta el nodo "OWNER_LIST" (Incluyendo ese mismo nodo "OWNER_LIST" y la seccion de procesamiento multmedia)
	3.3. Ir al workflow 3 creado en el paso 1.3 y copiar todos los nodos desde los INPUT hasta el mismo nodo "OWNER_LIST" y pegar en el flujo del agente sustituyendo los nodos que se borraron antes
	3.4. Eliminar la seccion de "Concatenador de Mensajes"
	3.5 Ir al workflow 3 de nuevo y copiar los nodos que vienen despues de "USER_FILTER", desde "livechat_in" y hasta "ClearAllMessages" y pegar en el flujo del agente, sustituyendo la seccion de "Concatenador de Mensajes"
	3.6. Eliminar nodos de blacklist a excepcion de los nodos de blacklist de WHAPI
	3.7. Ir al workflow 3 de nuevo y buscar el nodo "INSTANCE_JSON_PROMPT2" (Nodo Code), copiar todo el codigo y pegarlo en el mismo nodo que ya existe en el flujo del agente sustituyendo todo el codigo que ya hay
	3.8. Actualizar las credenciales en todos los nodos de supabase
	3.9. Ir a la seccion de INPUTS y actualizar los nodos code de cada input, para eso hay que buscar el nodo code de Whatsapp Oficial "INPUT_TYPE_DETERMINE_WHATSAPP" y copiarlo
	3.10. Ir a Gemini y pedirle que actualice los nodos code de cada input (Whapi, Telegram, Instagram, Twilio) en base al codigo del nodo que copiamos antes, para eso hay que darle a Gemini ambos codigos:

				- Codigo de nodo "INPUT_TYPE_DETERMINE_WHATSAPP"
				- Codigo de nodo INPUT (Whapi, Telegram, Instagram, Twilio).

	3.11. Sustituir Codigos que da Gemini en cada nodo code.

Tareas Pendientes

- Cambiar Credenciales de Open Router en flujos de n8n
