# Solución al Error UNAUTHENTICATED en Google Cloud Vision

## 🔍 Diagnóstico del Problema

El error `UNAUTHENTICATED` ocurre cuando Google Cloud rechaza las credenciales. Aunque el código puede parsear el JSON correctamente, el problema más común es que el `private_key` no tiene el formato correcto.

## ✅ Solución Paso a Paso

### Paso 1: Verificar los Logs en Render

Ve a Render → Tu servicio → "Logs" y busca estos mensajes al iniciar:

**✅ Si ves esto, el JSON se parseó correctamente:**
```
Inicializando Google Cloud Vision con credenciales desde variable de entorno
Project ID: repuestos-mp-486422
JSON parseado correctamente...
Credenciales válidas para: vision-api-service2@...
```

**❌ Si ves errores de parsing, el JSON está mal formateado.**

### Paso 2: El Problema Principal - Formato del `private_key`

El `private_key` en el JSON **DEBE** tener saltos de línea reales (`\n` como carácter), no como texto literal `\n`.

**Ejemplo de formato CORRECTO en el JSON:**
```json
{
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
}
```

**El código ahora convierte automáticamente `\\n` a `\n` real**, pero es mejor tenerlo correcto desde el inicio.

### Paso 3: Regenerar las Credenciales (Recomendado)

1. Ve a [Google Cloud Console - Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Selecciona tu proyecto `repuestos-mp-486422`
3. Busca la cuenta de servicio `vision-api-service2@repuestos-mp-486422.iam.gserviceaccount.com`
4. Haz clic en la cuenta de servicio
5. Ve a la pestaña "Keys"
6. Si hay claves existentes, puedes eliminarlas (opcional) o crear una nueva
7. Haz clic en "Add Key" → "Create new key"
8. Selecciona "JSON"
9. Se descargará un archivo JSON

### Paso 4: Preparar el JSON para Render

**Opción A - Usar PowerShell (Windows):**

1. Abre PowerShell
2. Ejecuta estos comandos (reemplaza la ruta con la de tu archivo):

```powershell
# Leer el archivo JSON
$jsonContent = Get-Content -Path "C:\ruta\a\tu\archivo-descargado.json" -Raw

# Convertir a objeto y luego a JSON minificado (una sola línea)
$jsonObj = $jsonContent | ConvertFrom-Json
$minified = $jsonObj | ConvertTo-Json -Compress -Depth 10

# Mostrar el resultado
$minified

# Copiar al portapapeles
$minified | Set-Clipboard
```

3. El resultado estará en tu portapapeles, listo para pegar en Render

**Opción B - Usar herramienta online:**

1. Ve a [jsonformatter.org](https://jsonformatter.org/)
2. Abre tu archivo JSON descargado
3. Copia TODO el contenido
4. Pégalo en jsonformatter.org
5. Haz clic en "Minify" o "Compress"
6. Copia el resultado (debe ser una sola línea)

**Opción C - Manualmente:**

1. Abre el archivo JSON en un editor de texto
2. Elimina TODOS los saltos de línea
3. Elimina espacios innecesarios (pero mantén espacios dentro de strings)
4. El resultado debe empezar con `{` y terminar con `}` en una sola línea

### Paso 5: Actualizar en Render

1. Ve a Render → Tu servicio → "Environment"
2. Busca `GOOGLE_CLOUD_KEY_FILE`
3. **Borra todo el contenido actual**
4. Pega el JSON de una sola línea que preparaste
5. Verifica que:
   - No tenga saltos de línea visibles
   - Empiece con `{`
   - Termine con `}`
   - El `private_key` tenga `\n` dentro del string (como texto literal `\n`, no como salto de línea real)
6. Haz clic en "Save Changes"
7. Render reiniciará automáticamente

### Paso 6: Verificar en los Logs

Después de reiniciar, revisa los logs. Deberías ver:

```
✅ Inicializando Google Cloud Vision con credenciales desde variable de entorno
✅ Project ID: repuestos-mp-486422
✅ JSON parseado correctamente...
✅ Credenciales válidas para: vision-api-service2@repuestos-mp-486422.iam.gserviceaccount.com
✅ Private key length: XXXX caracteres
✅ Private key starts with: -----BEGIN PRIVATE KEY-----...
✅ Usando Project ID: repuestos-mp-486422
✅ Verificando credenciales con una llamada de prueba...
✅ Credenciales verificadas correctamente con llamada de prueba
✅ Google Cloud Vision inicializado correctamente...
```

### Paso 7: Verificar Permisos en Google Cloud

Aunque las credenciales estén bien, también verifica:

1. **API Habilitada:**
   - Ve a [API Library](https://console.cloud.google.com/apis/library)
   - Busca "Cloud Vision API"
   - Verifica que esté "Enabled" (habilitada)

2. **Service Account Activa:**
   - Ve a [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
   - Verifica que `vision-api-service2@repuestos-mp-486422.iam.gserviceaccount.com` exista
   - Verifica que no esté deshabilitada

3. **Facturación:**
   - Ve a [Billing](https://console.cloud.google.com/billing)
   - Verifica que tu proyecto tenga facturación habilitada (aunque tengas free tier)

## 🐛 Troubleshooting Adicional

### Si el error persiste después de seguir los pasos:

1. **Verifica que el Project ID coincida:**
   - En Render, `GOOGLE_CLOUD_PROJECT_ID` debe ser exactamente `repuestos-mp-486422`
   - En el JSON, `project_id` debe ser exactamente `repuestos-mp-486422`

2. **Verifica el formato del private_key:**
   - Debe empezar con `-----BEGIN PRIVATE KEY-----`
   - Debe terminar con `-----END PRIVATE KEY-----`
   - Debe tener `\n` como texto literal dentro del string JSON

3. **Regenera las credenciales:**
   - Elimina la clave actual en Google Cloud Console
   - Crea una nueva clave JSON
   - Sigue los pasos anteriores para configurarla en Render

4. **Verifica los logs completos:**
   - Busca cualquier mensaje de error antes del error `UNAUTHENTICATED`
   - Los nuevos logs mostrarán más detalles sobre qué está fallando

## 📝 Nota Importante

El código ahora convierte automáticamente `\\n` a `\n` real en el `private_key`, pero es mejor tener el formato correcto desde el inicio para evitar problemas.

Si después de seguir todos estos pasos el error persiste, comparte los logs completos del inicio del servicio en Render para diagnosticar mejor el problema.
