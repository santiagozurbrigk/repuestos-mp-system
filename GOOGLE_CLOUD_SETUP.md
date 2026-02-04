# Configuración de Google Cloud Vision API

Esta guía te ayudará a configurar Google Cloud Vision API para el escaneo automático de facturas.

## 🎯 Free Tier de Google Cloud Vision API

- **1,000 unidades gratis por mes** (suficiente para ~1,000 facturas/mes)
- **$300 en créditos gratis** para nuevos usuarios
- Después del free tier: **$1.50 por cada 1,000 unidades adicionales**

## 📋 Pasos para Configurar

### 1. Crear cuenta en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea una cuenta o inicia sesión
3. Acepta los términos y condiciones

### 2. Crear un proyecto

1. En la consola, haz clic en el selector de proyectos (arriba)
2. Haz clic en "Nuevo proyecto"
3. Ingresa un nombre (ej: "repuestos-mp-ocr")
4. Haz clic en "Crear"

### 3. Habilitar Google Cloud Vision API

1. Ve a [API Library](https://console.cloud.google.com/apis/library)
2. Busca "Cloud Vision API"
3. Haz clic en "Cloud Vision API"
4. Haz clic en "Habilitar"
5. Espera a que se habilite (puede tardar unos minutos)

### 4. Crear credenciales (Service Account)

1. Ve a [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Selecciona tu proyecto
3. Haz clic en "Crear cuenta de servicio"
4. Ingresa un nombre (ej: "vision-api-service")
5. Haz clic en "Crear y continuar"
6. En "Otorgar acceso a este servicio":
   - **Opción 1 (Recomendada):** No asignes ningún rol y haz clic en "Continuar". La cuenta de servicio podrá usar la API si está habilitada.
   - **Opción 2:** Si prefieres asignar un rol, puedes usar **"Editor"** o **"Agente de servicio de Cloud Vision AI"** (si aparece en la lista)
7. Haz clic en "Continuar" y luego "Listo"

**Nota:** Para usar Cloud Vision API directamente, no es necesario asignar un rol específico. Solo asegúrate de que la API esté habilitada en tu proyecto.

### 5. Generar clave JSON

**⚠️ PROBLEMA COMÚN:** Si ves el error "La creación de claves de la cuenta de servicio está inhabilitada", tu organización tiene políticas de seguridad que bloquean esto. Tienes **3 soluciones**:

#### ✅ Solución 1: Crear un proyecto personal (RECOMENDADO)

Las políticas organizacionales solo aplican a proyectos dentro de la organización. Crea un proyecto personal:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Haz clic en el selector de proyectos → "Nuevo proyecto"
3. **IMPORTANTE:** Asegúrate de que el proyecto NO esté bajo ninguna organización
4. Crea el proyecto y sigue los pasos anteriores desde el paso 3
5. En un proyecto personal, podrás generar claves JSON sin problemas

#### Solución 2: Usar Application Default Credentials (solo desarrollo local)

**Limitación:** Solo funciona en tu máquina local, NO en producción (Render/Vercel).

1. Instala [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Ejecuta en tu terminal:
   ```bash
   gcloud auth application-default login
   ```
3. Selecciona tu cuenta de Google Cloud
4. El código detectará automáticamente las credenciales

**Nota:** Esta opción NO funcionará en Render/Vercel, solo localmente.

#### Solución 3: Contactar al administrador (si es posible)

Si necesitas usar el proyecto organizacional, contacta a tu administrador de Google Cloud para:
- Deshabilitar la política `iam.disableServiceAccountKeyCreation`
- O crear una excepción para tu proyecto específico

#### Opción A: Descargar clave JSON (si está permitido)

1. En la lista de cuentas de servicio, haz clic en la que acabas de crear
2. Ve a la pestaña "Claves"
3. Haz clic en "Agregar clave" → "Crear nueva clave"
4. Selecciona "JSON"
5. Haz clic en "Crear"
6. Se descargará un archivo JSON (guárdalo en un lugar seguro)

### 6. Configurar variables de entorno

Tienes **tres opciones** para configurar las credenciales:

#### Opción A: Archivo JSON (Recomendado para desarrollo local)

1. Copia el archivo JSON descargado a la carpeta `backend/`
2. Renómbralo a `google-credentials.json` (o el nombre que prefieras)
3. Agrega al `.env` del backend:

```env
GOOGLE_CLOUD_PROJECT_ID=tu-project-id
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

**⚠️ IMPORTANTE:** Agrega `google-credentials.json` al `.gitignore` para no subirlo al repositorio.

#### Opción B: Variable de entorno (Recomendado para producción)

1. Abre el archivo JSON descargado
2. Copia TODO el contenido del JSON
3. En Render/Vercel, agrega estas variables de entorno:

```env
GOOGLE_CLOUD_PROJECT_ID=tu-project-id
GOOGLE_CLOUD_KEY_FILE={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

**Nota:** El `GOOGLE_CLOUD_KEY_FILE` debe ser el JSON completo como una sola línea (sin saltos de línea).

#### Opción C: Application Default Credentials (Solo desarrollo local)

Si usaste `gcloud auth application-default login`:

1. **NO necesitas configurar variables de entorno** para las credenciales
2. Solo agrega al `.env` del backend:

```env
GOOGLE_CLOUD_PROJECT_ID=tu-project-id
```

El código detectará automáticamente las credenciales configuradas con `gcloud`.

**⚠️ LIMITACIÓN:** Esta opción NO funciona en producción (Render/Vercel). Solo para desarrollo local.

### 7. Obtener el Project ID

El Project ID lo encuentras en:
- [Project Settings](https://console.cloud.google.com/iam-admin/settings)
- O en el selector de proyectos (aparece entre paréntesis)

## ✅ Verificar la Configuración

Una vez configurado, puedes probar el escaneo de facturas:

1. Ve al apartado "Proveedores"
2. Haz clic en "Escanear Factura Completa"
3. Sube una imagen de factura
4. El sistema debería extraer automáticamente los datos

## 🔧 Troubleshooting

### Error: "Servicio de OCR no disponible"

- Verifica que las variables de entorno estén configuradas correctamente
- Asegúrate de que el archivo JSON existe (si usas Opción A)
- Verifica que el Project ID sea correcto

### Error: "PERMISSION_DENIED"

- Verifica que la cuenta de servicio tenga el rol "Cloud Vision API User"
- Asegúrate de que la API esté habilitada en tu proyecto

### Error: "INVALID_ARGUMENT"

- Verifica que la imagen sea válida (JPG, PNG o PDF)
- Asegúrate de que la imagen sea clara y legible

## 📊 Límites y Costos

- **Free Tier:** 1,000 unidades/mes gratis
- **Después:** $1.50 por cada 1,000 unidades
- **Ejemplo:** 2,000 facturas/mes = $1.50 (solo pagas las 1,000 adicionales)

## 🔐 Seguridad

- **NUNCA** subas el archivo JSON de credenciales al repositorio
- Usa variables de entorno en producción
- Rota las credenciales periódicamente si es necesario

## 📚 Recursos

- [Documentación de Google Cloud Vision API](https://cloud.google.com/vision/docs)
- [Pricing de Vision API](https://cloud.google.com/vision/pricing)
- [Guía de autenticación](https://cloud.google.com/docs/authentication)
