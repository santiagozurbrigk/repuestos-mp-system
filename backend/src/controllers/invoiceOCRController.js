import { ImageAnnotatorClient } from '@google-cloud/vision'
import { supabase } from '../config/supabase.js'
import config from '../config/env.js'
import { logger } from '../utils/logger.js'
import { getBuenosAiresDateString } from '../utils/dateHelpers.js'

// Inicializar cliente de Google Cloud Vision
let visionClient = null
let visionClientError = null

try {
  // Intentar inicializar con credenciales
  if (config.GOOGLE_APPLICATION_CREDENTIALS) {
    // Si hay un path al archivo JSON
    logger.info('Inicializando Google Cloud Vision con archivo de credenciales')
    visionClient = new ImageAnnotatorClient({
      keyFilename: config.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: config.GOOGLE_CLOUD_PROJECT_ID,
    })
    logger.info('Google Cloud Vision inicializado correctamente con archivo de credenciales')
  } else if (config.GOOGLE_CLOUD_KEY_FILE) {
    // Si el JSON está como string en la variable de entorno
    logger.info('Inicializando Google Cloud Vision con credenciales desde variable de entorno')
    logger.info(`Project ID: ${config.GOOGLE_CLOUD_PROJECT_ID || 'NO CONFIGURADO'}`)
    logger.info(`GOOGLE_CLOUD_KEY_FILE length: ${config.GOOGLE_CLOUD_KEY_FILE?.length || 0} caracteres`)
    
    try {
      // Limpiar y normalizar el JSON
      let jsonString = config.GOOGLE_CLOUD_KEY_FILE.trim()
      
      // Si el JSON viene con saltos de línea reales (multilínea desde Render), convertirlo a una sola línea
      // Primero, preservar los \n dentro de los valores de strings (como private_key)
      // Luego eliminar saltos de línea reales fuera de los strings
      
      // Intentar parsear directamente primero
      let credentials
      let parseAttempt = 1
      
      try {
        // Intento 1: Parsear directamente
        credentials = JSON.parse(jsonString)
        logger.info('JSON parseado correctamente en primer intento')
      } catch (firstError) {
        logger.warn(`Error en primer intento de parseo: ${firstError.message}`)
        
        try {
          // Intento 2: Eliminar saltos de línea reales y espacios extra, pero preservar \n dentro de strings
          // Convertir saltos de línea reales a espacios, excepto dentro de comillas
          let cleanedJson = ''
          let insideString = false
          let escapeNext = false
          
          for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString[i]
            
            if (escapeNext) {
              cleanedJson += char
              escapeNext = false
              continue
            }
            
            if (char === '\\') {
              escapeNext = true
              cleanedJson += char
              continue
            }
            
            if (char === '"' && !escapeNext) {
              insideString = !insideString
              cleanedJson += char
              continue
            }
            
            if (char === '\n' || char === '\r') {
              // Si estamos dentro de un string, mantener el salto de línea como \n
              if (insideString) {
                cleanedJson += '\\n'
              } else {
                // Si estamos fuera de un string, eliminar el salto de línea
                cleanedJson += ' '
              }
            } else if (char === ' ' && !insideString) {
              // Normalizar espacios múltiples fuera de strings
              if (cleanedJson[cleanedJson.length - 1] !== ' ') {
                cleanedJson += char
              }
            } else {
              cleanedJson += char
            }
          }
          
          credentials = JSON.parse(cleanedJson.trim())
          logger.info('JSON parseado correctamente después de limpiar saltos de línea')
        } catch (secondError) {
          logger.error(`Error en segundo intento de parseo: ${secondError.message}`)
          
          // Intento 3: Usar una estrategia más simple - eliminar todos los saltos de línea y espacios extra
          try {
            const minifiedJson = jsonString
              .replace(/\r\n/g, ' ')
              .replace(/\n/g, ' ')
              .replace(/\r/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
            
            credentials = JSON.parse(minifiedJson)
            logger.info('JSON parseado después de minificar completamente')
          } catch (thirdError) {
            throw new Error(`No se pudo parsear el JSON después de 3 intentos. Último error: ${thirdError.message}. Primeros 200 caracteres: ${jsonString.substring(0, 200)}`)
          }
        }
      }

      // Validar que las credenciales tengan los campos necesarios
      if (!credentials.client_email) {
        throw new Error('Las credenciales no contienen client_email')
      }
      
      if (!credentials.private_key) {
        throw new Error('Las credenciales no contienen private_key')
      }
      
      // Validar que private_key tenga el formato correcto
      if (!credentials.private_key.includes('BEGIN PRIVATE KEY')) {
        logger.warn('El private_key no parece tener el formato PEM correcto')
      }
      
      // Validar y normalizar el private_key
      // El private_key debe tener saltos de línea reales, no \n como texto
      if (credentials.private_key.includes('\\n')) {
        logger.info('Convirtiendo \\n literales a saltos de línea reales en private_key')
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
      }
      
      // Verificar que el private_key tenga el formato correcto después de la conversión
      if (!credentials.private_key.includes('\n')) {
        logger.warn('El private_key no contiene saltos de línea. Esto puede causar problemas de autenticación.')
      }
      
      logger.info(`Credenciales válidas para: ${credentials.client_email}`)
      logger.info(`Private key length: ${credentials.private_key.length} caracteres`)
      logger.info(`Private key starts with: ${credentials.private_key.substring(0, 30)}...`)
      
      // Usar el project_id del JSON si está disponible, o el de la variable de entorno
      const projectId = credentials.project_id || config.GOOGLE_CLOUD_PROJECT_ID
      
      if (!projectId) {
        throw new Error('No se encontró project_id en las credenciales ni en GOOGLE_CLOUD_PROJECT_ID')
      }
      
      // Verificar que el project_id coincida si ambos están configurados
      if (credentials.project_id && config.GOOGLE_CLOUD_PROJECT_ID && credentials.project_id !== config.GOOGLE_CLOUD_PROJECT_ID) {
        logger.warn(`Advertencia: project_id en credenciales (${credentials.project_id}) no coincide con GOOGLE_CLOUD_PROJECT_ID (${config.GOOGLE_CLOUD_PROJECT_ID}). Usando el de las credenciales.`)
      }
      
      logger.info(`Usando Project ID: ${projectId}`)

      visionClient = new ImageAnnotatorClient({
        credentials,
        projectId: projectId,
      })
      
      // Intentar hacer una llamada de prueba para verificar las credenciales
      logger.info('Verificando credenciales con una llamada de prueba...')
      try {
        // Hacer una llamada de prueba con una imagen pequeña (1x1 pixel PNG)
        const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
        await visionClient.documentTextDetection({
          image: { content: testImage },
        })
        logger.info('✅ Credenciales verificadas correctamente con llamada de prueba')
      } catch (testError) {
        logger.error('❌ Error al verificar credenciales con llamada de prueba:', {
          code: testError.code,
          message: testError.message,
        })
        // No lanzar error aquí, solo registrar. El cliente se creó pero puede fallar en uso real
      }
      
      logger.info('Google Cloud Vision inicializado correctamente con credenciales desde variable de entorno')
    } catch (parseError) {
      visionClientError = `Error al parsear credenciales: ${parseError.message}`
      logger.error(visionClientError, {
        error: parseError,
        jsonPreview: config.GOOGLE_CLOUD_KEY_FILE?.substring(0, 200),
      })
      visionClient = null
    }
  } else if (config.GOOGLE_CLOUD_PROJECT_ID) {
    // Intentar usar credenciales por defecto (gcloud auth application-default login)
    logger.info('Inicializando Google Cloud Vision con credenciales por defecto')
    visionClient = new ImageAnnotatorClient({
      projectId: config.GOOGLE_CLOUD_PROJECT_ID,
    })
    logger.info('Google Cloud Vision inicializado con credenciales por defecto')
  } else {
    visionClientError = 'No se encontraron credenciales de Google Cloud. Configure GOOGLE_CLOUD_KEY_FILE o GOOGLE_APPLICATION_CREDENTIALS'
    logger.warn(visionClientError)
  }
} catch (error) {
  visionClientError = `Error al inicializar Google Cloud Vision: ${error.message}`
  logger.error(visionClientError, error)
  visionClient = null
}

/**
 * Procesa una imagen de factura usando Google Cloud Vision API
 * Extrae automáticamente: proveedor, número, fechas, importe y productos
 */
export const processInvoiceImage = async (req, res) => {
  try {
    const userId = req.user.id

    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' })
    }

    // Verificar que Google Cloud Vision esté configurado
    if (!visionClient) {
      logger.error('Google Cloud Vision no está configurado.', { error: visionClientError })
      return res.status(503).json({
        error: visionClientError || 'Servicio de OCR no disponible. Configure las credenciales de Google Cloud.',
        details: process.env.NODE_ENV === 'development' ? visionClientError : undefined,
      })
    }

    const imageBuffer = req.file.buffer

    logger.info('Procesando imagen de factura con Google Cloud Vision...')

    // Llamar a Google Cloud Vision Document Text Detection
    const [result] = await visionClient.documentTextDetection({
      image: { content: imageBuffer },
    })

    const fullTextAnnotation = result.fullTextAnnotation

    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      logger.warn('No se encontró texto en la imagen', {
        hasAnnotation: !!fullTextAnnotation,
        hasText: !!fullTextAnnotation?.text,
        fileSize: imageBuffer.length,
        fileType: req.file.mimetype,
      })
      return res.status(400).json({
        error: 'No se pudo extraer texto de la imagen. Asegúrate de que sea una factura clara y legible. Si el problema persiste, intenta con una imagen de mayor resolución.',
      })
    }
    
    // Verificar que el texto extraído tenga suficiente contenido
    const extractedText = fullTextAnnotation.text
    if (extractedText.length < 50) {
      logger.warn('Texto extraído muy corto', { length: extractedText.length, preview: extractedText.substring(0, 100) })
      return res.status(400).json({
        error: 'El texto extraído de la imagen es muy corto. Asegúrate de que la imagen sea clara y contenga texto legible.',
      })
    }

    // Parsear el texto extraído para encontrar datos de la factura
    logger.info('Iniciando parsing del texto extraído', { 
      textLength: extractedText.length,
      preview: extractedText.substring(0, 500) 
    })
    
    const parsedData = parseInvoiceText(extractedText)
    
    logger.info('Datos extraídos de la factura:', {
      vendorName: parsedData.vendorName,
      invoiceNumber: parsedData.invoiceNumber,
      invoiceDate: parsedData.invoiceDate,
      dueDate: parsedData.dueDate,
      totalAmount: parsedData.totalAmount,
      itemsCount: parsedData.items.length,
      itemsPreview: parsedData.items.slice(0, 3).map(item => ({
        name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price
      }))
    })

    // Buscar o crear proveedor por nombre
    let supplierId = null
    let supplierInfo = null

    if (parsedData.vendorName) {
      // Buscar proveedor existente por nombre (búsqueda exacta primero, luego parcial)
      const { data: exactMatch } = await supabase
        .from('suppliers')
        .select('*')
        .ilike('name', parsedData.vendorName.trim())
        .limit(1)

      if (exactMatch && exactMatch.length > 0) {
        supplierId = exactMatch[0].id
        supplierInfo = exactMatch[0]
      } else {
        // Búsqueda parcial
        const { data: partialMatch } = await supabase
          .from('suppliers')
          .select('*')
          .ilike('name', `%${parsedData.vendorName.trim()}%`)
          .limit(1)

        if (partialMatch && partialMatch.length > 0) {
          supplierId = partialMatch[0].id
          supplierInfo = partialMatch[0]
        } else {
          // Crear nuevo proveedor automáticamente
          const { data: newSupplier, error: supplierError } = await supabase
            .from('suppliers')
            .insert([
              {
                user_id: userId,
                name: parsedData.vendorName.trim(),
              },
            ])
            .select()
            .single()

          if (!supplierError && newSupplier) {
            supplierId = newSupplier.id
            supplierInfo = newSupplier
            logger.info(`Proveedor creado automáticamente: ${parsedData.vendorName}`)
          }
        }
      }
    }

    // Preparar respuesta
    const extractedData = {
      supplier_id: supplierId,
      supplier_name: parsedData.vendorName || null,
      invoice_number: parsedData.invoiceNumber || null,
      invoice_date: parsedData.invoiceDate || getBuenosAiresDateString(),
      due_date: parsedData.dueDate || null,
      amount: parsedData.totalAmount || 0,
      items: parsedData.items || [],
      raw_text: extractedText.substring(0, 500), // Primeros 500 caracteres para debugging
    }

    logger.info(`Factura procesada exitosamente. Items encontrados: ${parsedData.items.length}`)

    res.json({
      success: true,
      data: extractedData,
      message: supplierId
        ? 'Factura procesada correctamente. Revisa los datos antes de guardar.'
        : 'Factura procesada. Debes seleccionar o crear un proveedor antes de guardar.',
    })
  } catch (error) {
    logger.error('Error al procesar imagen de factura:', error)

    // Manejar errores específicos de Google Cloud
    if (error.code === 16 || error.code === 7 || error.message?.includes('UNAUTHENTICATED') || error.message?.includes('PERMISSION_DENIED')) {
      logger.error('Error de autenticación con Google Cloud Vision', {
        code: error.code,
        message: error.message,
        hasCredentials: !!config.GOOGLE_CLOUD_KEY_FILE || !!config.GOOGLE_APPLICATION_CREDENTIALS,
        hasProjectId: !!config.GOOGLE_CLOUD_PROJECT_ID,
      })
      return res.status(503).json({
        error: 'Error de autenticación con Google Cloud. Verifica que las credenciales estén configuradas correctamente en Render.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      })
    }

    if (error.code === 3 || error.message?.includes('INVALID_ARGUMENT')) {
      return res.status(400).json({
        error: 'La imagen proporcionada no es válida. Asegúrate de que sea una imagen clara de una factura.',
      })
    }

    res.status(500).json({
      error: 'Error al procesar la imagen de la factura. Intenta nuevamente.',
    })
  }
}

/**
 * Parsea el texto extraído para encontrar datos de la factura
 * Esta función usa expresiones regulares y patrones comunes en facturas argentinas
 */
function parseInvoiceText(text) {
  logger.info('=== INICIANDO PARSE INVOICE TEXT ===')
  
  const result = {
    vendorName: null,
    invoiceNumber: null,
    invoiceDate: null,
    dueDate: null,
    totalAmount: 0,
    items: [],
  }

  // Normalizar el texto (remover espacios múltiples, normalizar saltos de línea)
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
  
  logger.info(`Texto procesado: ${lines.length} líneas encontradas`)
  logger.info('Primeras 10 líneas:', lines.slice(0, 10))

  // 1. Buscar nombre del proveedor (generalmente en las primeras líneas)
  logger.info('=== BUSCANDO PROVEEDOR ===')
  // Buscar patrones comunes: "RAZÓN SOCIAL", nombre de empresa en mayúsculas, etc.
  const vendorKeywords = ['razón social', 'razon social', 'proveedor', 'vendedor', 'empresa']
  const excludeVendorWords = ['sucursal', 'domicilio', 'localidad', 'tel:', 'email', 'www.', 'http', 'dirección', 'direccion', 'alquimac', 'mar del plata', 'buenos aires']
  
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i]
    const lineLower = line.toLowerCase()
    
    if (i < 10) { // Solo loggear las primeras 10 líneas para no saturar
      logger.info(`Línea ${i}: ${line.substring(0, 80)}`)
    }
    
    // Buscar línea que contenga palabras clave de proveedor
    if (vendorKeywords.some(kw => lineLower.includes(kw))) {
      // La siguiente línea o la misma línea puede contener el nombre
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        const nextLineLower = nextLine.toLowerCase()
        if (nextLine.length > 5 && 
            /^[A-ZÁÉÍÓÚÑ\s\.]+$/.test(nextLine.trim()) &&
            !excludeVendorWords.some(word => nextLineLower.includes(word))) {
          result.vendorName = nextLine.trim()
          break
        }
      }
    }
    
    // Buscar líneas en mayúsculas que parezcan nombres de empresa
    // Excluir palabras como "SUCURSAL", "DOMICILIO", etc.
    // Primero verificar si tiene SRL/SA/etc (prioridad alta)
    if (line.match(/\b(SRL|SA|S\.A\.|S\.R\.L\.|LTDA|INC)\b/i)) {
      // Si tiene SRL/SA/etc, verificar que no sea una línea excluida
      if (
        line.length > 10 &&
        line.length < 80 &&
        !/^\d+/.test(line) &&
        !/^\d{2}\/\d{2}\/\d{4}/.test(line) &&
        !lineLower.includes('factura') &&
        !lineLower.includes('cuit') &&
        !lineLower.includes('fecha') &&
        !excludeVendorWords.some(word => lineLower.includes(word)) &&
        !lineLower.includes('ventas@') &&
        !lineLower.includes('www.') &&
        !lineLower.includes('tel:') &&
        !lineLower.includes('sucursal') &&
        !lineLower.includes('domicilio')
      ) {
        result.vendorName = line.trim()
        logger.info(`Proveedor encontrado (con SRL/SA): ${result.vendorName} en línea ${i}`)
        break
      }
    }
    
    // Si no tiene SRL/SA, buscar otras líneas que parezcan nombres de empresa
    if (
      line.length > 10 &&
      line.length < 80 &&
      /^[A-ZÁÉÍÓÚÑ\s\.]+$/.test(line.trim()) &&
      !/^\d+/.test(line) &&
      !/^\d{2}\/\d{2}\/\d{4}/.test(line) &&
      !lineLower.includes('factura') &&
      !lineLower.includes('cuit') &&
      !lineLower.includes('fecha') &&
      !excludeVendorWords.some(word => lineLower.includes(word)) &&
      !lineLower.includes('ing. brutos') &&
      !lineLower.includes('responsable') &&
      !lineLower.includes('inscripto') &&
      !lineLower.includes('ventas@') &&
      !lineLower.includes('www.') &&
      !lineLower.includes('tel:')
    ) {
      if (line.split(/\s+/).length >= 3) {
        // Preferir nombres más largos y que no sean solo ubicaciones
        if (!result.vendorName || 
            (line.length > result.vendorName.length && 
             line.length < 80 &&
             !lineLower.includes('mar del plata') &&
             !lineLower.includes('buenos aires'))) {
          result.vendorName = line.trim()
          logger.info(`Proveedor candidato encontrado: ${result.vendorName} en línea ${i}`)
        }
      }
    }
  }
  
  // Si encontramos un nombre pero contiene palabras excluidas, buscar uno mejor antes
  if (result.vendorName && (result.vendorName.toLowerCase().includes('sucursal') || 
                            result.vendorName.toLowerCase().includes('alquimac') ||
                            result.vendorName.toLowerCase().includes('mar del plata'))) {
    logger.warn(`Proveedor encontrado contiene palabras excluidas: ${result.vendorName}, buscando alternativa`)
    for (let i = 0; i < Math.min(25, lines.length); i++) {
      const line = lines[i]
      const lineLower = line.toLowerCase()
      
      // Buscar cualquier línea que tenga formato de empresa y no contenga palabras excluidas (genérico)
      if (line.length > 10 &&
          line.length < 80 &&
          /^[A-ZÁÉÍÓÚÑ\s\.]+$/.test(line.trim()) &&
          !lineLower.includes('sucursal') &&
          !lineLower.includes('domicilio') &&
          !lineLower.includes('localidad') &&
          !lineLower.includes('tel:') &&
          !lineLower.includes('email') &&
          !lineLower.includes('www.') &&
          !lineLower.includes('alquimac') &&
          !lineLower.includes('mar del plata') &&
          (line.match(/\b(SRL|SA|S\.A\.|S\.R\.L\.|LTDA|INC)\b/i) || 
           line.split(/\s+/).length >= 3)) {
        result.vendorName = line.trim()
        logger.info(`Proveedor corregido a: ${result.vendorName}`)
        break
      }
    }
  }
  
  // Si no se encontró proveedor, buscar en más líneas (genérico, sin palabras específicas)
  if (!result.vendorName) {
    logger.warn('No se encontró proveedor en las primeras 20 líneas, buscando en más líneas')
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const line = lines[i]
      const lineLower = line.toLowerCase()
      
      // Buscar líneas que tengan formato de empresa (SRL, SA, etc.) y no sean excluidas
      if (line.match(/\b(SRL|SA|S\.A\.|S\.R\.L\.|LTDA|INC)\b/i)) {
        if (
          line.length > 10 &&
          line.length < 80 &&
          !/^\d+/.test(line) &&
          !/^\d{2}\/\d{2}\/\d{4}/.test(line) &&
          !lineLower.includes('factura') &&
          !lineLower.includes('cuit') &&
          !lineLower.includes('fecha') &&
          !excludeVendorWords.some(word => lineLower.includes(word)) &&
          !lineLower.includes('ventas@') &&
          !lineLower.includes('www.') &&
          !lineLower.includes('tel:') &&
          !lineLower.includes('sucursal') &&
          !lineLower.includes('domicilio')
        ) {
          result.vendorName = line.trim()
          logger.info(`Proveedor encontrado (búsqueda extendida): ${result.vendorName} en línea ${i}`)
          break
        }
      }
    }
  }
  
  logger.info(`Proveedor final: ${result.vendorName || 'NO ENCONTRADO'}`)

  // 2. Buscar número de factura
  logger.info('=== BUSCANDO NÚMERO DE FACTURA ===')
  // Buscar específicamente después de "FACTURA" o "N°" para evitar CUITs
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineLower = line.toLowerCase()
    
    if (lineLower.includes('factura') || lineLower.includes('n°') || lineLower.includes('nro')) {
      logger.info(`Línea ${i} (posible factura): ${line}`)
    }
    
    // Buscar líneas que contengan "FACTURA" seguido de número con formato específico
    if (lineLower.includes('factura')) {
      // Buscar patrón: FACTURA A No: 00020-00385324 o FACTURA N°: 00020-00385324
      // Buscar el número completo con guión directamente en la línea, preservando ceros iniciales
      // Patrón mejorado que captura números de 3-5 dígitos antes del guión
      const fullNumberMatch = line.match(/(?:factura\s+[a-z]?\s*(?:n[°#o]|no|nro|numero)\s*:?\s*)?(\d{3,5}[\s-]\d{4,8})/i)
      if (fullNumberMatch) {
        let number = fullNumberMatch[1].replace(/\s/g, '')
        
        // Verificar que no sea un CUIT (los CUITs tienen formato XX-XXXXXXXX-X)
        if (!number.match(/^\d{2}-\d{8}-\d{1}$/)) {
          result.invoiceNumber = number
          logger.info(`Número de factura encontrado en línea ${i}: ${number} (de: ${line})`)
          break
        } else {
          logger.info(`Número encontrado pero es CUIT, ignorando: ${number}`)
        }
      }
      
      // Si no se encontró con el patrón completo, intentar con el patrón anterior
      const invoiceMatch = line.match(/factura\s+[a-z]?\s*(?:n[°#o]|no|nro|numero)\s*:?\s*(\d{1,4}[\s-]?\d{4,8})/i)
      if (invoiceMatch) {
        let number = invoiceMatch[1].replace(/\s/g, '')
        
        // Si el número no tiene guión pero debería tenerlo, buscar el número completo en la línea
        if (!number.includes('-') && line.match(/\d{1,4}[\s-]\d{4,8}/)) {
          const fullMatch = line.match(/(\d{1,4}[\s-]\d{4,8})/)
          if (fullMatch) {
            number = fullMatch[1].replace(/\s/g, '')
          }
        }
        
        // Verificar que no sea un CUIT
        if (!number.match(/^\d{2}-\d{8}-\d{1}$/)) {
          result.invoiceNumber = number
          logger.info(`Número de factura encontrado (patrón alternativo) en línea ${i}: ${number} (de: ${line})`)
          break
        }
      }
    }
    
    // Buscar formato específico: "N°: 00020-00385324" o "NRO: 00020-00385324"
    if ((lineLower.includes('n°') || lineLower.includes('nro') || lineLower.includes('numero')) && 
        !lineLower.includes('cuit')) {
      const numberMatch = line.match(/(?:n°|nro|numero)[\s:]*(\d{1,4}[\s-]?\d{4,8})/i)
      if (numberMatch) {
        const number = numberMatch[1].replace(/\s/g, '')
        // Verificar que no sea un CUIT
        if (!number.match(/^\d{2}-\d{8}-\d{1}$/)) {
          result.invoiceNumber = number
          logger.info(`Número de factura encontrado (alternativo): ${number}`)
          break
        }
      }
    }
  }
  
  // Si no se encontró, buscar en el texto normalizado pero excluyendo CUITs
  if (!result.invoiceNumber) {
    // Buscar específicamente en líneas que contengan "Factura" y un número después
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineLower = line.toLowerCase()
      
      if (lineLower.includes('factura') && lineLower.includes('no')) {
        // Buscar patrón más específico: "Factura A No: 00020-00385324"
        const specificMatch = line.match(/factura\s+[a-z]?\s*no\s*:?\s*(\d{1,4}[\s-]?\d{4,8})/i)
        if (specificMatch) {
          const number = specificMatch[1].replace(/\s/g, '')
          if (!number.match(/^\d{2}-\d{8}-\d{1}$/)) {
            result.invoiceNumber = number
            logger.info(`Número de factura encontrado (búsqueda específica): ${number}`)
            break
          }
        }
      }
    }
    
    // Si aún no se encontró, buscar en texto normalizado pero ser más estricto
    if (!result.invoiceNumber) {
      const invoiceNumberPatterns = [
        /factura\s+[a-z]?\s*(?:n[°#o]|no|nro|numero)\s*:?\s*(\d{1,4}[\s-]?\d{4,8})/i,
      ]

      for (const pattern of invoiceNumberPatterns) {
        const match = normalizedText.match(pattern)
        if (match) {
          const number = match[1].replace(/\s/g, '')
          // Excluir CUITs y verificar que tenga formato de factura (al menos 8 dígitos totales)
          if (!number.match(/^\d{2}-\d{8}-\d{1}$/) && number.replace(/-/g, '').length >= 8) {
            result.invoiceNumber = number
            logger.info(`Número de factura encontrado (texto normalizado): ${number}`)
            break
          }
        }
      }
    }
  }

  // 3. Buscar fechas
  logger.info('=== BUSCANDO FECHAS ===')
  // Buscar específicamente "Fecha Emisión" y "Fecha de Vto" o "Vencimiento"
  const datePatterns = [
    /(\d{2}\/\d{2}\/\d{4})/g, // DD/MM/YYYY
    /(\d{4}-\d{2}-\d{2})/g, // YYYY-MM-DD
    /(\d{2}-\d{2}-\d{4})/g, // DD-MM-YYYY
  ]

  // Buscar fecha de emisión
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineLower = line.toLowerCase()
    
    if (lineLower.includes('fecha') && (lineLower.includes('emisión') || lineLower.includes('emision'))) {
      const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/)
      if (dateMatch) {
        result.invoiceDate = parseDate(dateMatch[1])
        break
      }
    }
  }

  // Buscar fecha de vencimiento
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineLower = line.toLowerCase()
    
    if (lineLower.includes('vencimiento') || lineLower.includes('vto') || 
        (lineLower.includes('fecha') && lineLower.includes('vto'))) {
      const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/)
      if (dateMatch) {
        result.dueDate = parseDate(dateMatch[1])
        break
      }
    }
  }

  // Si no se encontraron fechas específicas, buscar todas las fechas y usar la primera como emisión
  if (!result.invoiceDate || !result.dueDate) {
    const dates = []
    for (const pattern of datePatterns) {
      const matches = normalizedText.match(pattern)
      if (matches) {
        dates.push(...matches)
      }
    }

    // Eliminar duplicados
    const uniqueDates = [...new Set(dates)]

    if (uniqueDates.length > 0 && !result.invoiceDate) {
      result.invoiceDate = parseDate(uniqueDates[0])
    }
    
    if (uniqueDates.length > 1 && !result.dueDate) {
      result.dueDate = parseDate(uniqueDates[1])
    }
  }

  // 4. Buscar importe total
  logger.info('=== BUSCANDO MONTO TOTAL ===')
  // Buscar específicamente la línea "TOTAL" evitando subtotales e impuestos
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineLower = line.toLowerCase()
    
    // Buscar línea que diga solo "TOTAL" o "TOTAL:" sin otras palabras como "SUBTOTAL" o "IVA"
    if (lineLower.includes('total') && 
        !lineLower.includes('subtotal') && 
        !lineLower.includes('iva') &&
        !lineLower.includes('pibbb') &&
        !lineLower.includes('ingresos brutos')) {
      
      logger.info(`Línea ${i} con TOTAL encontrada: ${line}`)
      
      // Buscar número grande en esta línea y en las siguientes 5 líneas (el total puede estar más abajo)
      let searchLines = [line]
      for (let j = 1; j <= 5; j++) {
        if (i + j < lines.length) {
          searchLines.push(lines[i + j])
          logger.info(`Línea ${i + j} (después de TOTAL): ${lines[i + j]}`)
        }
      }
      
      // También buscar en líneas anteriores (a veces el total está antes de la palabra TOTAL)
      for (let j = 1; j <= 2; j++) {
        if (i - j >= 0) {
          searchLines.unshift(lines[i - j])
          logger.info(`Línea ${i - j} (antes de TOTAL): ${lines[i - j]}`)
        }
      }
      
      const allNumbers = []
      for (const searchLine of searchLines) {
        // Buscar números con formato argentino: puede tener puntos para miles y coma para decimales
        const numbers = searchLine.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/g)
        if (numbers) {
          allNumbers.push(...numbers)
        }
      }
      
      if (allNumbers.length > 0) {
        logger.info(`Números encontrados en líneas TOTAL: ${allNumbers.join(', ')}`)
        // Convertir todos los números y tomar el más grande
        const amounts = allNumbers
          .map(num => {
            // Parsear formato argentino: puntos para miles, coma para decimales
            const cleaned = num.replace(/\./g, '').replace(',', '.')
            const parsed = parseFloat(cleaned) || 0
            logger.info(`Parseando número: ${num} -> ${parsed}`)
            return parsed
          })
          .filter(num => num > 10000 && num < 100000000) // Filtrar números razonables (más de 10,000)
          .sort((a, b) => b - a)
        
        logger.info(`Montos parseados (después de filtrar > 10000): ${amounts.join(', ')}`)
        
        if (amounts.length > 0) {
          result.totalAmount = amounts[0]
          logger.info(`Monto total seleccionado: ${result.totalAmount}`)
          break
        } else {
          logger.warn(`No se encontraron montos válidos (> 10000) en líneas TOTAL. Todos los números: ${allNumbers.join(', ')}`)
          // Si no encontramos un monto válido, buscar el número más grande en un rango más amplio
          // Buscar en líneas alrededor de TOTAL (hasta 10 líneas después)
          const extendedNumbers = []
          for (let j = 0; j <= 10; j++) {
            if (i + j < lines.length) {
              const extendedLine = lines[i + j]
              const extNumbers = extendedLine.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/g)
              if (extNumbers) {
                extendedNumbers.push(...extNumbers)
              }
            }
          }
          
          if (extendedNumbers.length > 0) {
            logger.info(`Buscando en rango extendido, números encontrados: ${extendedNumbers.join(', ')}`)
            const extendedAmounts = extendedNumbers
              .map(num => {
                const cleaned = num.replace(/\./g, '').replace(',', '.')
                return parseFloat(cleaned) || 0
              })
              .filter(num => num > 50000 && num < 100000000) // Buscar números grandes (más de 50,000)
              .sort((a, b) => b - a)
            
            logger.info(`Montos en rango extendido (después de filtrar > 50000): ${extendedAmounts.join(', ')}`)
            
            if (extendedAmounts.length > 0) {
              result.totalAmount = extendedAmounts[0]
              logger.info(`Monto total seleccionado (rango extendido): ${result.totalAmount}`)
              break
            }
          }
        }
      } else {
        logger.warn(`No se encontraron números en las líneas TOTAL`)
      }
    }
  }

  // Si no se encontró, buscar en el texto normalizado
  if (result.totalAmount === 0) {
    const totalPatterns = [
      /(?:^|\s)(?:total|total\s+a\s+pagar|importe\s+total)[\s:]*\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,
    ]

    for (const pattern of totalPatterns) {
      const match = normalizedText.match(pattern)
      if (match) {
        const amountStr = match[1].replace(/\./g, '').replace(',', '.')
        const amount = parseFloat(amountStr) || 0
        if (amount > 1000 && amount < 100000000) {
          result.totalAmount = amount
          break
        }
      }
    }
  }

  // Si aún no se encontró, buscar el número más grande que parezca un importe razonable
  // pero excluir números que parezcan ser impuestos parciales
  if (result.totalAmount === 0) {
    const largeNumbers = normalizedText.match(/\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g)
    if (largeNumbers) {
      const amounts = largeNumbers
        .map((num) => parseFloat(num.replace(/\./g, '').replace(',', '.')))
        .filter((num) => num > 10000 && num < 100000000) // Filtrar números razonables (más de 10,000)
        .sort((a, b) => b - a) // Ordenar de mayor a menor

      if (amounts.length > 0) {
        result.totalAmount = amounts[0] // El más grande probablemente es el total
      }
    }
  }

  // 5. Buscar productos/items
  logger.info('=== BUSCANDO PRODUCTOS ===')
  // Buscar la tabla de productos identificando encabezados comunes
  const productTableKeywords = [
    'articulo', 'artículo', 'producto', 'descripcion', 'descripción',
    'cant', 'cantidad', 'p. unit', 'precio unit', 'unitario',
    'total', 'importe', 'marca', 'codigo', 'código'
  ]
  
  // Palabras que indican que NO es un producto (encabezados/metadatos)
  const excludeKeywords = [
    'factura', 'n°', 'nro', 'numero', 'número', 'código n°', 'codigo n°',
    'fecha', 'emisión', 'vencimiento', 'vto', 'página', 'pagina',
    'cuit', 'ing. brutos', 'ingresos brutos', 'domicilio', 'localidad',
    'cliente', 'vendedor', 'cond iva', 'responsable', 'inscripto',
    'subtotal', 'iva', 'pibbb', 'importe en letras', 'caea',
    'observaciones', 'ud dispone', 'formas de pago', 'vencimiento',
    'razón social', 'razon social', 'sucursal', 'tel:', 'email',
    'www.', 'http', 'dirección', 'direccion'
  ]

  // Buscar el inicio de la tabla de productos
  let productTableStart = -1
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase()
    // Buscar línea que contenga múltiples palabras clave de tabla de productos
    const keywordCount = productTableKeywords.filter(kw => lineLower.includes(kw)).length
    if (keywordCount >= 2) {
      productTableStart = i + 1 // Empezar después del encabezado
      logger.info(`Tabla de productos encontrada en línea ${i}: ${lines[i]}`)
      break
    }
  }
  
  if (productTableStart === -1) {
    logger.warn('No se encontró encabezado claro de tabla de productos, buscando productos en todas las líneas')
    // Intentar buscar encabezados alternativos más flexibles
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const lineLower = lines[i].toLowerCase()
      // Buscar líneas que contengan al menos una palabra clave de productos
      const keywordCount = productTableKeywords.filter(kw => lineLower.includes(kw)).length
      if (keywordCount >= 1 && (lineLower.includes('marca') || lineLower.includes('codigo') || lineLower.includes('articulo'))) {
        productTableStart = i + 1
        logger.info(`Tabla de productos encontrada (método alternativo) en línea ${i}: ${lines[i]}`)
        break
      }
    }
  }

  // Si no encontramos encabezado claro, buscar líneas que parezcan productos en toda la factura
  if (productTableStart === -1) {
    logger.info('Buscando productos sin encabezado claro, analizando todas las líneas')
    
    // Buscar líneas con formato de tabla: texto + números (cantidad/precio)
    let processedLines = 0
    for (let i = 0; i < lines.length; i++) {
      processedLines++
      const line = lines[i]
      const lineLower = line.toLowerCase()
      
      // Detener si encontramos totales o resúmenes
      if (lineLower.includes('subtotal') || 
          (lineLower.includes('total') && (lineLower.includes('iva') || lineLower.includes('pibbb')))) {
        break
      }
      
      // Verificar que no sea un encabezado/metadato
      const isExcluded = excludeKeywords.some(kw => lineLower.includes(kw))
      if (isExcluded) continue
      
      // Loggear líneas que parecen productos (tienen texto y números) - rango más amplio
      if (i >= 38 && i <= 70 && /[A-Z]/.test(line) && /\d/.test(line) && line.length > 10) {
        logger.info(`Línea ${i} (posible producto): ${line}`)
      }
      
      // Loggear líneas que tienen números grandes (posibles precios)
      if (i >= 38 && i <= 70 && line.match(/\d{1,3}(?:\.\d{3})+(?:,\d{2})?/)) {
        logger.info(`Línea ${i} (contiene número grande): ${line}`)
      }
      
      // Patrón 1: MARCA CODIGO DESCRIPCION CANT P.UNIT DTO TOTAL (más flexible)
      // Ejemplo: "MD 24703 BULBO CHEV. CORSA 1 17.083,90 46% 9.225,31"
      const tablePattern1 = /^([A-ZÁÉÍÓÚÑ\s]{1,25})\s+(\d{3,})\s+([A-ZÁÉÍÓÚÑ\s\.\-]{5,60})\s+(\d{1,2})\s+(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:\d+%|\d+\.\d+%)?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)$/
      const match1 = line.match(tablePattern1)
      
      if (match1) {
        logger.info(`Línea ${i} coincide con patrón 1: ${line.substring(0, 100)}`)
        const [, marca, codigo, descripcion, cantidad, precioUnitStr, totalStr] = match1
        
        const parseArgentineNumber = (numStr) => {
          if (!numStr) return 0
          // Remover puntos (separadores de miles) y reemplazar coma por punto para decimales
          const cleaned = numStr.trim().replace(/\./g, '').replace(',', '.')
          return parseFloat(cleaned) || 0
        }
        
        const qty = parseFloat(cantidad) || 1
        const unitPrice = parseArgentineNumber(precioUnitStr)
        const totalPrice = parseArgentineNumber(totalStr)
        
        logger.info(`Patrón 1 parseado - Marca: ${marca}, Código: ${codigo}, Desc: ${descripcion}, Cant: ${qty}, PrecioUnit: ${precioUnitStr} -> ${unitPrice}, Total: ${totalStr} -> ${totalPrice}`)
        
        // Validar que los precios sean razonables (más de 100 y menos de 10 millones)
        if (unitPrice >= 100 && unitPrice < 10000000 && descripcion.trim().length > 3) {
          result.items.push({
            item_name: `${marca.trim()} ${descripcion.trim()}`.trim(),
            quantity: qty,
            unit_price: unitPrice,
            total_price: totalPrice > 0 ? totalPrice : (qty * unitPrice),
            description: `Código: ${codigo}`,
          })
          logger.info(`Producto encontrado (patrón 1): ${marca.trim()} ${descripcion.trim()} - Cant: ${qty}, Precio: ${unitPrice}, Total: ${totalPrice}`)
          continue
        } else {
          logger.warn(`Producto rechazado por precio inválido (patrón 1): ${descripcion.trim()} - Precio: ${unitPrice}`)
        }
      }
      
      // Patrón 2: DESCRIPCION CANT PRECIO TOTAL (sin marca/código)
      const tablePattern2 = /^([A-ZÁÉÍÓÚÑ\s\.\-]{5,60})\s+(\d{1,2})\s+(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s+(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)$/
      const match2 = line.match(tablePattern2)
      
      if (match2) {
        const [, descripcion, cantidad, precioUnitStr, totalStr] = match2
        
        // Verificar que la descripción no sea solo números o fechas
        if (!/^\d+$/.test(descripcion.trim()) && !/^\d{2}\/\d{2}\/\d{4}/.test(descripcion.trim())) {
          const parseArgentineNumber = (numStr) => {
            if (!numStr) return 0
            const cleaned = numStr.trim().replace(/\./g, '').replace(',', '.')
            return parseFloat(cleaned) || 0
          }
          
          const qty = parseFloat(cantidad) || 1
          const unitPrice = parseArgentineNumber(precioUnitStr)
          const totalPrice = parseArgentineNumber(totalStr)
          
          if (unitPrice >= 100 && unitPrice < 10000000 && totalPrice > 0 && totalPrice < 10000000) {
            result.items.push({
              item_name: descripcion.trim(),
              quantity: qty,
              unit_price: unitPrice,
              total_price: totalPrice || (qty * unitPrice),
              description: null,
            })
            logger.info(`Producto encontrado (patrón 2): ${descripcion.trim()} - Cant: ${qty}, Precio: ${unitPrice}, Total: ${totalPrice}`)
            continue
          }
        }
      }
      
      // Patrón 3: Solo descripción y precio (más flexible)
      const simplePattern = /^([A-ZÁÉÍÓÚÑ\s\.\-]{5,50})\s+(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)$/
      const match3 = line.match(simplePattern)
      
      if (match3 && !match1 && !match2) {
        const [, descripcion, precioStr] = match3
        
        // Verificar que no sea un campo de encabezado
        if (!excludeKeywords.some(kw => descripcion.toLowerCase().includes(kw))) {
          const unitPrice = parseFloat(precioStr.replace(/\./g, '').replace(',', '.')) || 0
          
          if (unitPrice > 100 && unitPrice < 10000000 && descripcion.trim().length > 5) {
            result.items.push({
              item_name: descripcion.trim(),
              quantity: 1,
              unit_price: unitPrice,
              total_price: unitPrice,
              description: null,
            })
          }
        }
      }
    }
  } else {
    // Parsear productos desde la tabla identificada
    for (let i = productTableStart; i < Math.min(productTableStart + 100, lines.length); i++) {
      const line = lines[i]
      const lineLower = line.toLowerCase()
      
      // Detener si encontramos totales o resúmenes
      if (lineLower.includes('subtotal') || 
          lineLower.includes('total') && (lineLower.includes('iva') || lineLower.includes('pibbb'))) {
        break
      }
      
      // Verificar que no sea un encabezado/metadato
      const isExcluded = excludeKeywords.some(kw => lineLower.includes(kw))
      if (isExcluded) continue
      
      // Buscar patrones de productos en formato de tabla
      // Patrón 1: MARCA CODIGO DESCRIPCION CANT P.UNIT DTO TOTAL
      // Ejemplo: "MD 24703 BULBO CHEV. CORSA 1 17.083,90 46% 9.225,31"
      // Patrón más flexible que captura números completos con formato argentino
      const tablePattern1 = /^([A-ZÁÉÍÓÚÑ\s]{1,25})\s+(\d{3,})\s+([A-ZÁÉÍÓÚÑ\s\.\-]{5,60})\s+(\d{1,2})\s+(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:\d+%|\d+\.\d+%)?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)$/
      const match1 = line.match(tablePattern1)
      
      if (match1) {
        logger.info(`Línea ${i} coincide con patrón 1: ${line.substring(0, 100)}`)
        const [, marca, codigo, descripcion, cantidad, precioUnitStr, totalStr] = match1
        
        // Parsear números con formato argentino (puntos para miles, coma para decimales)
        const parseArgentineNumber = (numStr) => {
          if (!numStr) return 0
          // Remover puntos (separadores de miles) y reemplazar coma por punto para decimales
          const cleaned = numStr.trim().replace(/\./g, '').replace(',', '.')
          return parseFloat(cleaned) || 0
        }
        
        const qty = parseFloat(cantidad) || 1
        const unitPrice = parseArgentineNumber(precioUnitStr)
        const totalPrice = parseArgentineNumber(totalStr)
        
        // Validar que los precios sean razonables (más de 100 y menos de 10 millones)
        if (unitPrice >= 100 && unitPrice < 10000000 && descripcion.trim().length > 3) {
          result.items.push({
            item_name: `${marca.trim()} ${descripcion.trim()}`.trim(),
            quantity: qty,
            unit_price: unitPrice,
            total_price: totalPrice > 0 ? totalPrice : (qty * unitPrice),
            description: `Código: ${codigo}`,
          })
          logger.info(`Producto encontrado (patrón 1): ${marca.trim()} ${descripcion.trim()} - Cant: ${qty}, Precio: ${unitPrice}, Total: ${totalPrice}`)
          continue
        } else {
          logger.warn(`Producto rechazado por precio inválido: ${descripcion.trim()} - Precio: ${unitPrice}`)
        }
      }
      
      // Patrón 2: DESCRIPCION CANT PRECIO (sin marca/código al inicio)
      const tablePattern2 = /^([A-ZÁÉÍÓÚÑ\s\.]{5,50})\s+(\d{1,2})\s+(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s+(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)$/
      const match2 = line.match(tablePattern2)
      
      if (match2) {
        const [, descripcion, cantidad, precioUnitStr, totalStr] = match2
        
        // Verificar que la descripción no sea solo números o fechas
        if (!/^\d+$/.test(descripcion.trim()) && !/^\d{2}\/\d{2}\/\d{4}/.test(descripcion.trim())) {
          const qty = parseFloat(cantidad) || 1
          const unitPrice = parseFloat(precioUnitStr.replace(/\./g, '').replace(',', '.')) || 0
          const totalPrice = parseFloat(totalStr.replace(/\./g, '').replace(',', '.')) || 0
          
          if (unitPrice > 0 && unitPrice < 10000000 && totalPrice > 0 && totalPrice < 10000000) {
            result.items.push({
              item_name: descripcion.trim(),
              quantity: qty,
              unit_price: unitPrice,
              total_price: totalPrice || (qty * unitPrice),
              description: null,
            })
          }
        }
      }
      
      // Patrón 3: Solo descripción y precio (sin cantidad explícita, asumir 1)
      const simplePattern = /^([A-ZÁÉÍÓÚÑ\s\.]{5,50})\s+(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)$/
      const match3 = line.match(simplePattern)
      
      if (match3 && !match1 && !match2) {
        const [, descripcion, precioStr] = match3
        
        // Verificar que no sea un campo de encabezado
        if (!excludeKeywords.some(kw => descripcion.toLowerCase().includes(kw))) {
          const unitPrice = parseFloat(precioStr.replace(/\./g, '').replace(',', '.')) || 0
          
          if (unitPrice > 100 && unitPrice < 10000000 && descripcion.trim().length > 5) {
            result.items.push({
              item_name: descripcion.trim(),
              quantity: 1,
              unit_price: unitPrice,
              total_price: unitPrice,
              description: null,
            })
          }
        }
      }
    }
  }

  logger.info(`Items encontrados antes de filtrar: ${result.items.length}`)
  if (result.items.length > 0) {
    logger.info('Primeros 5 items encontrados:', result.items.slice(0, 5).map(item => ({
      name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price
    })))
  }
  
  // Filtrar items duplicados o inválidos
  result.items = result.items.filter((item, index, self) => {
    // Eliminar items con nombres muy cortos o que sean claramente metadatos
    if (item.item_name.length < 3) return false
    
    // Eliminar items que sean claramente campos de encabezado
    const nameLower = item.item_name.toLowerCase()
    if (excludeKeywords.some(kw => nameLower.includes(kw))) return false
    
    // Eliminar items con precios inválidos
    if (item.unit_price <= 0 || item.unit_price > 10000000) return false
    if (item.quantity <= 0 || item.quantity > 1000) return false
    
    // Eliminar duplicados exactos
    return index === self.findIndex(i => 
      i.item_name === item.item_name && 
      i.unit_price === item.unit_price &&
      i.quantity === item.quantity
    )
  })
  
  logger.info(`Items después de filtrar: ${result.items.length}`)
  if (result.items.length > 0) {
    logger.info('Items finales:', result.items.map(item => ({
      name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price
    })))
  }
  
  logger.info('=== FIN PARSE INVOICE TEXT ===')
  logger.info('Resumen final:', {
    vendorName: result.vendorName,
    invoiceNumber: result.invoiceNumber,
    invoiceDate: result.invoiceDate,
    dueDate: result.dueDate,
    totalAmount: result.totalAmount,
    itemsCount: result.items.length
  })

  return result
}

/**
 * Función auxiliar para parsear fechas en diferentes formatos
 */
function parseDate(dateStr) {
  if (!dateStr) return null

  // Intentar diferentes formatos comunes
  const formats = [
    /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
  ]

  for (const format of formats) {
    const match = dateStr.match(format)
    if (match) {
      if (format === formats[0]) {
        // DD/MM/YYYY
        const [, day, month, year] = match
        return `${year}-${month}-${day}`
      } else if (format === formats[1]) {
        // YYYY-MM-DD
        return match[0]
      } else if (format === formats[2]) {
        // DD-MM-YYYY
        const [, day, month, year] = match
        return `${year}-${month}-${day}`
      }
    }
  }

  return null
}
