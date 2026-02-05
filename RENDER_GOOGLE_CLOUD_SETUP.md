# Configuración de Google Cloud Vision en Render

## ⚠️ Problema Común: Error UNAUTHENTICATED

Si estás viendo el error `UNAUTHENTICATED`, generalmente es porque el formato del JSON en Render no es correcto.

## ✅ Solución: Configurar correctamente en Render

### Paso 1: Preparar el JSON

1. Abre tu archivo JSON de credenciales de Google Cloud (el que descargaste)
2. **Convierte el JSON a una sola línea** usando una de estas opciones:

   **Opción A - Usar herramienta online:**
   - Ve a [jsonformatter.org](https://jsonformatter.org/)
   - Pega tu JSON completo
   - Haz clic en "Minify" o "Compress"
   - Copia el resultado (debe ser una sola línea)

   **Opción B - Usar PowerShell (Windows):**
   ```powershell
   $json = Get-Content -Path "ruta\a\tu\archivo.json" -Raw
   $minified = ($json | ConvertFrom-Json | ConvertTo-Json -Compress)
   $minified
   ```

   **Opción C - Manualmente:**
   - Elimina todos los saltos de línea
   - Elimina espacios innecesarios (pero mantén espacios dentro de strings si son necesarios)
   - El resultado debe empezar con `{` y terminar con `}` en una sola línea

### Paso 2: Configurar en Render

1. Ve a tu servicio en Render
2. Haz clic en "Environment" en el menú lateral
3. Busca o crea estas variables:

   **Variable 1:**
   - **Key:** `GOOGLE_CLOUD_PROJECT_ID`
   - **Value:** Tu Project ID (ej: `repuestos-mp-486422`)

   **Variable 2:**
   - **Key:** `GOOGLE_CLOUD_KEY_FILE`
   - **Value:** El JSON completo en UNA SOLA LÍNEA (sin saltos de línea)

### Paso 3: Ejemplo de formato correcto

**❌ INCORRECTO (con saltos de línea):**
```
{
  "type": "service_account",
  "project_id": "repuestos-mp-486422",
  "private_key": "-----BEGIN PRIVATE KEY-----\nABC123\n-----END PRIVATE KEY-----\n"
}
```

**✅ CORRECTO (una sola línea):**
```
{"type":"service_account","project_id":"repuestos-mp-486422","private_key":"-----BEGIN PRIVATE KEY-----\nABC123\n-----END PRIVATE KEY-----\n","client_email":"vision-api-service2@repuestos-mp-486422.iam.gserviceaccount.com"}
```

### Paso 4: Guardar y reiniciar

1. Haz clic en "Save Changes"
2. Render reiniciará automáticamente el servicio
3. Espera a que el servicio esté "Live"

### Paso 5: Verificar en los logs

Después de reiniciar, ve a "Logs" en Render y busca estos mensajes:

**✅ Si está bien configurado, verás:**
```
Inicializando Google Cloud Vision con credenciales desde variable de entorno
Project ID: repuestos-mp-486422
GOOGLE_CLOUD_KEY_FILE length: 1234 caracteres
JSON parseado correctamente en primer intento
Credenciales válidas para: vision-api-service2@repuestos-mp-486422.iam.gserviceaccount.com
Usando Project ID: repuestos-mp-486422
Google Cloud Vision inicializado correctamente con credenciales desde variable de entorno
```

**❌ Si hay problemas, verás:**
```
Error al parsear credenciales: ...
```

## 🔍 Verificar permisos en Google Cloud

Aunque las credenciales estén bien formateadas, también necesitas verificar:

1. **API habilitada:**
   - Ve a [API Library](https://console.cloud.google.com/apis/library)
   - Busca "Cloud Vision API"
   - Verifica que esté "Enabled"

2. **Service Account activa:**
   - Ve a [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
   - Verifica que la cuenta `vision-api-service2@repuestos-mp-486422.iam.gserviceaccount.com` exista
   - Verifica que la clave JSON no haya sido eliminada

3. **Facturación (si aplica):**
   - Verifica que tu proyecto tenga facturación habilitada (aunque tengas free tier)

## 🐛 Troubleshooting

### Error: "Error al parsear credenciales"

- Verifica que el JSON esté en una sola línea
- Verifica que no tenga comillas adicionales alrededor
- Verifica que los `\n` dentro de `private_key` estén como texto literal (no como saltos de línea reales)

### Error: "No se encontró project_id"

- Verifica que `GOOGLE_CLOUD_PROJECT_ID` esté configurado
- O verifica que el JSON incluya el campo `project_id`

### Error: "Las credenciales no contienen client_email o private_key"

- Verifica que el JSON esté completo
- Verifica que no se haya cortado al copiarlo
- Intenta regenerar las credenciales desde Google Cloud Console

## 📝 Nota sobre el formato multilínea en Render

Render permite pegar JSON multilínea en el campo de texto, pero internamente lo trata como una sola línea con saltos de línea reales (`\n`). El código ahora maneja esto automáticamente, pero es mejor usar el formato de una sola línea para evitar problemas.
