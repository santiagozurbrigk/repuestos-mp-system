import { ImageAnnotatorClient } from '@google-cloud/vision'
import { supabase } from '../config/supabase.js'
import config from '../config/env.js'
import { logger } from '../utils/logger.js'
import { getBuenosAiresDateString } from '../utils/dateHelpers.js'
// pdf-parse v2+ usa PDFParse como clase

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

    const fileBuffer = req.file.buffer
    const fileMimeType = req.file.mimetype
    const isPDF = fileMimeType === 'application/pdf'

    logger.info(`Procesando ${isPDF ? 'PDF' : 'imagen'} de factura con Google Cloud Vision...`, {
      mimeType: fileMimeType,
      fileSize: fileBuffer.length,
    })

    let extractedText = null

    if (isPDF) {
      // Para PDFs, primero intentar extraer texto nativo (si el PDF tiene texto seleccionable)
      // Si no tiene texto nativo, es un PDF escaneado y necesitamos usar OCR
      try {
        logger.info('Intentando extraer texto nativo del PDF...')
        
        // Importar pdf-parse dinámicamente (v2+ usa PDFParse como clase)
        const { PDFParse } = await import('pdf-parse')
        
        // Crear instancia del parser con el buffer del PDF
        const parser = new PDFParse({ data: fileBuffer })
        const pdfData = await parser.getText()
        
        // PDFParse.getText() retorna un objeto con text y metadata
        const pdfText = pdfData.text || pdfData
        const numPages = pdfData.numPages || pdfData.numpages || 1
        
        if (pdfText && typeof pdfText === 'string' && pdfText.trim().length > 50) {
          // PDF con texto nativo - extracción directa (máxima precisión)
          extractedText = pdfText
          logger.info(`✅ Texto nativo extraído del PDF: ${extractedText.length} caracteres, ${numPages} página(s)`)
        } else {
          // PDF escaneado (sin texto nativo) - usar Google Cloud Vision OCR
          logger.info('PDF sin texto nativo detectado, usando OCR de Google Cloud Vision...')
          
          // Google Cloud Vision requiere que los PDFs estén en Cloud Storage o convertirlos a imágenes
          // Para PDFs escaneados, necesitamos convertir cada página a imagen
          // Por ahora, intentamos con la primera página usando documentTextDetection
          // NOTA: Esto solo procesará la primera página del PDF
          
          const [result] = await visionClient.documentTextDetection({
            image: { content: fileBuffer },
          })

          const fullTextAnnotation = result.fullTextAnnotation

          if (!fullTextAnnotation || !fullTextAnnotation.text) {
            logger.warn('No se encontró texto en el PDF escaneado', {
              hasAnnotation: !!fullTextAnnotation,
              hasText: !!fullTextAnnotation?.text,
              fileSize: fileBuffer.length,
              numPages: pdfData.numpages,
            })
            return res.status(400).json({
              error: 'No se pudo extraer texto del PDF escaneado. El PDF parece estar escaneado pero el OCR no pudo leerlo. Intenta con una imagen de mejor calidad o un PDF con texto seleccionable.',
            })
          }

          extractedText = fullTextAnnotation.text
          logger.info(`Texto extraído del PDF escaneado (OCR): ${extractedText.length} caracteres`)
        }
      } catch (pdfError) {
        logger.error('Error al procesar PDF:', pdfError)
        
        // Si pdf-parse falla, intentar con Google Cloud Vision directamente
        try {
          logger.info('Intentando procesar PDF con Google Cloud Vision como fallback...')
          const [result] = await visionClient.documentTextDetection({
            image: { content: fileBuffer },
          })

          const fullTextAnnotation = result.fullTextAnnotation
          if (fullTextAnnotation && fullTextAnnotation.text && fullTextAnnotation.text.length > 50) {
            extractedText = fullTextAnnotation.text
            logger.info(`Texto extraído del PDF (fallback OCR): ${extractedText.length} caracteres`)
          } else {
            throw new Error('No se pudo extraer texto con ningún método')
          }
        } catch (fallbackError) {
          logger.error('Error en fallback de procesamiento PDF:', fallbackError)
          return res.status(400).json({
            error: 'Error al procesar el PDF. Asegúrate de que sea un PDF válido con texto legible o seleccionable.',
            details: process.env.NODE_ENV === 'development' ? pdfError.message : undefined,
          })
        }
      }
    } else {
      // Para imágenes (JPG, PNG, etc.)
      const [result] = await visionClient.documentTextDetection({
        image: { content: fileBuffer },
      })

      const fullTextAnnotation = result.fullTextAnnotation

      if (!fullTextAnnotation || !fullTextAnnotation.text) {
        logger.warn('No se encontró texto en la imagen', {
          hasAnnotation: !!fullTextAnnotation,
          hasText: !!fullTextAnnotation?.text,
          fileSize: fileBuffer.length,
          fileType: fileMimeType,
        })
        return res.status(400).json({
          error: 'No se pudo extraer texto de la imagen. Asegúrate de que sea una factura clara y legible. Si el problema persiste, intenta con una imagen de mayor resolución o usa un PDF.',
        })
      }

      extractedText = fullTextAnnotation.text
    }
    
    // Verificar que el texto extraído tenga suficiente contenido
    if (!extractedText || extractedText.length < 50) {
      logger.warn('Texto extraído muy corto', { 
        length: extractedText?.length || 0, 
        preview: extractedText?.substring(0, 100),
        fileType: fileMimeType,
      })
      return res.status(400).json({
        error: `El texto extraído del ${isPDF ? 'PDF' : 'archivo'} es muy corto. Asegúrate de que ${isPDF ? 'el PDF contenga texto seleccionable o sea una imagen escaneada clara' : 'la imagen sea clara y contenga texto legible'}.`,
      })
    }

    // Parsear el texto extraído para encontrar datos de la factura
    logger.info(`Iniciando parsing del texto extraído desde ${isPDF ? 'PDF' : 'imagen'}`, { 
      textLength: extractedText.length,
      preview: extractedText.substring(0, 500),
      fileType: fileMimeType,
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

  // 1. Buscar nombre del proveedor - ESTRATEGIA GENÉRICA
  logger.info('=== BUSCANDO PROVEEDOR ===')
  // Estrategia: buscar en las primeras 15 líneas líneas que:
  // 1. Contengan SRL/SA/etc (prioridad máxima)
  // 2. Sean texto en mayúsculas/mixtas con al menos 3 palabras
  // 3. No contengan números al inicio, fechas, o palabras de contexto (factura, cuit, fecha, etc.)
  // 4. No sean direcciones, teléfonos, emails, etc.
  
  const excludePatterns = [
    /^\d+/,  // Empieza con número
    /^\d{2}[-\/]\d{2}[-\/]\d{4}/,  // Es una fecha
    /factura/i,
    /cuit/i,
    /fecha/i,
    /vencimiento/i,
    /inicio de actividades/i,
    /ing\.?\s*brutos/i,
    /responsable/i,
    /inscripto/i,
    /condicion de pago/i,
    /sr\.?\/es?:/i,
    /cliente:/i,
    /domicilio/i,
    /localidad/i,
    /tel:/i,
    /email/i,
    /www\./i,
    /http/i,
    /sucursal/i,
    /@/i,  // Contiene email
    /\|\s*/,  // Contiene pipe (separador de direcciones)
  ]
  
  // Primero buscar líneas con SRL/SA/etc en las primeras 15 líneas
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i].trim()
    const lineLower = line.toLowerCase()
    
    if (i < 10) {
      logger.info(`Línea ${i}: ${line.substring(0, 80)}`)
    }
    
    // Si tiene SRL/SA/etc, es muy probable que sea el proveedor
    if (line.match(/\b(SRL|SA|S\.A\.|S\.R\.L\.|LTDA|INC)\b/i)) {
      // Verificar que no sea una línea excluida
      const isExcluded = excludePatterns.some(pattern => pattern.test(line))
      
      if (!isExcluded && 
          line.length > 8 && 
          line.length < 100 &&
          line.split(/\s+/).length >= 2) {
        // Limpiar la línea: puede tener información adicional después de |
        const cleanName = line.split('|')[0].trim()
        if (cleanName.length > 8) {
          result.vendorName = cleanName
          logger.info(`Proveedor encontrado (con SRL/SA) en línea ${i}: ${result.vendorName}`)
          break
        }
      }
    }
  }
  
  // Si no encontramos con SRL/SA, buscar líneas que parezcan nombres de empresa
  if (!result.vendorName) {
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const line = lines[i].trim()
      const lineLower = line.toLowerCase()
      
      // Debe ser texto en mayúsculas/mixtas, con al menos 2 palabras, sin números al inicio
      if (line.length > 8 && 
          line.length < 100 &&
          line.split(/\s+/).length >= 2 &&
          /^[A-ZÁÉÍÓÚÑ]/.test(line) &&  // Empieza con mayúscula
          !excludePatterns.some(pattern => pattern.test(line))) {
        
        // Limpiar la línea si tiene información adicional
        const cleanName = line.split('|')[0].trim().split('Tel:')[0].trim()
        
        if (cleanName.length > 8 && cleanName.split(/\s+/).length >= 2) {
          result.vendorName = cleanName
          logger.info(`Proveedor encontrado (genérico) en línea ${i}: ${result.vendorName}`)
          break
        }
      }
    }
  }
  
  logger.info(`Proveedor final: ${result.vendorName || 'NO ENCONTRADO'}`)

  // 2. Buscar número de factura - ESTRATEGIA GENÉRICA
  logger.info('=== BUSCANDO NÚMERO DE FACTURA ===')
  // Estrategia: buscar números con formato de factura (con guión) cerca de la palabra "FACTURA" o "N°"
  // Formato típico: XXXX-XXXXXXX o XXXX-XXXXXXXX (3-5 dígitos antes del guión, 4-8 después)
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineLower = line.toLowerCase()
    
    // Buscar líneas que contengan "FACTURA" o "N°"
    if (lineLower.includes('factura') || lineLower.includes('n°') || lineLower.includes('nro')) {
      logger.info(`Línea ${i} (posible factura): ${line}`)
      
      // Buscar número con formato de factura en la misma línea o líneas siguientes (hasta 3 líneas después)
      for (let j = i; j < Math.min(i + 4, lines.length); j++) {
        const searchLine = lines[j]
        // Buscar patrón: número con guión (formato de factura)
        const numberMatch = searchLine.match(/(\d{1,5}[\s-]\d{4,10})/)
        if (numberMatch) {
          let number = numberMatch[1].replace(/\s/g, '')
          
          // Verificar que no sea CUIT (formato XX-XXXXXXXX-X)
          // Verificar que no sea CAEA (13-14 dígitos sin guión o con guión largo)
          const digitCount = number.replace(/-/g, '').length
          const isCuit = number.match(/^\d{2}-\d{8}-\d{1}$/)
          const isCaea = digitCount >= 13 || searchLine.toLowerCase().includes('caea')
          
          if (!isCuit && !isCaea && digitCount >= 8 && digitCount <= 15) {
            result.invoiceNumber = number
            logger.info(`Número de factura encontrado en línea ${j}: ${number} (cerca de línea ${i})`)
            break
          }
        }
      }
      
      if (result.invoiceNumber) break
    }
  }
  
  // Si no se encontró, buscar cualquier número con formato de factura en las primeras 30 líneas
  if (!result.invoiceNumber) {
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const line = lines[i]
      const lineLower = line.toLowerCase()
      
      // Excluir líneas que claramente no son números de factura
      if (lineLower.includes('caea') || 
          lineLower.includes('cuit') || 
          lineLower.includes('pedido') || 
          lineLower.includes('entrega')) {
        continue
      }
      
      const numberMatch = line.match(/(\d{1,5}[\s-]\d{4,10})/)
      if (numberMatch) {
        let number = numberMatch[1].replace(/\s/g, '')
        const digitCount = number.replace(/-/g, '').length
        const isCuit = number.match(/^\d{2}-\d{8}-\d{1}$/)
        
        if (!isCuit && digitCount >= 8 && digitCount <= 15) {
          result.invoiceNumber = number
          logger.info(`Número de factura encontrado (búsqueda genérica) en línea ${i}: ${number}`)
          break
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

  // Buscar fecha de emisión - ESTRATEGIA GENÉRICA
  // Buscar fechas cerca de "FECHA" pero priorizar las que están más arriba y no son "INICIO DE ACTIVIDADES" o "CAEA"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineLower = line.toLowerCase()
    
    // Buscar líneas con "FECHA" pero excluir contextos no deseados
    if (lineLower.includes('fecha') && 
        !lineLower.includes('inicio de actividades') &&
        !lineLower.includes('caea') &&
        !lineLower.includes('vencimiento') &&
        !lineLower.includes('vto')) {
      // Buscar formato DD-MM-YYYY o DD/MM/YYYY en la misma línea o siguiente
      for (let j = i; j < Math.min(i + 2, lines.length); j++) {
        const searchLine = lines[j]
        const dateMatch = searchLine.match(/(\d{2}[-\/]\d{2}[-\/]\d{4})/)
        if (dateMatch) {
          const dateStr = dateMatch[1].replace(/-/g, '/')
          result.invoiceDate = parseDate(dateStr)
          logger.info(`Fecha de factura encontrada en línea ${j}: ${dateStr} (cerca de línea ${i}: ${line})`)
          break
        }
      }
      if (result.invoiceDate) break
    }
  }
  
  // Si no se encontró, buscar la primera fecha válida en las primeras 20 líneas (excluyendo contextos no deseados)
  if (!result.invoiceDate) {
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i]
      const lineLower = line.toLowerCase()
      
      // Excluir líneas con contextos no deseados
      if (lineLower.includes('inicio de actividades') ||
          lineLower.includes('caea') ||
          lineLower.includes('vencimiento caea')) {
        continue
      }
      
      const dateMatch = line.match(/(\d{2}[-\/]\d{2}[-\/]\d{4})/)
      if (dateMatch) {
        const dateStr = dateMatch[1].replace(/-/g, '/')
        result.invoiceDate = parseDate(dateStr)
        logger.info(`Fecha de factura encontrada (fallback) en línea ${i}: ${dateStr}`)
        break
      }
    }
  }

  // Buscar fecha de vencimiento - ESTRATEGIA GENÉRICA
  // Buscar fechas cerca de "vencimiento", "vto", o "CONDICION DE PAGO"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineLower = line.toLowerCase()
    
    // Buscar específicamente "Fecha vencimiento", "CONDICION DE PAGO", o "Vencimiento"
    if ((lineLower.includes('fecha') && lineLower.includes('vencimiento')) ||
        (lineLower.includes('condicion de pago') || lineLower.includes('condición de pago')) ||
        (lineLower.includes('vencimiento') && !lineLower.includes('caea'))) {
      // Buscar fecha en la misma línea o líneas siguientes (hasta 2 líneas después)
      for (let j = i; j < Math.min(i + 3, lines.length); j++) {
        const searchLine = lines[j]
        const dateMatch = searchLine.match(/(\d{2}[-\/]\d{2}[-\/]\d{4})/)
        if (dateMatch) {
          const dateStr = dateMatch[1].replace(/-/g, '/')
          result.dueDate = parseDate(dateStr)
          logger.info(`Fecha de vencimiento encontrada en línea ${j}: ${dateStr} (cerca de línea ${i}: ${line})`)
          break
        }
      }
      if (result.dueDate) break
    }
  }
  
  // Si no se encontró, buscar fechas después de la fecha de factura pero excluyendo CAEA
  if (!result.dueDate && result.invoiceDate) {
    const invoiceDateIndex = lines.findIndex((line, idx) => {
      const dateMatch = line.match(/(\d{2}[-\/]\d{2}[-\/]\d{4})/)
      if (dateMatch) {
        const dateStr = dateMatch[1].replace(/-/g, '/')
        return parseDate(dateStr) === result.invoiceDate
      }
      return false
    })
    
    if (invoiceDateIndex >= 0) {
      // Buscar la siguiente fecha válida después de la fecha de factura
      for (let i = invoiceDateIndex + 1; i < Math.min(invoiceDateIndex + 15, lines.length); i++) {
        const line = lines[i]
        const lineLower = line.toLowerCase()
        
        // Excluir fechas de CAEA
        if (lineLower.includes('caea')) {
          continue
        }
        
        const dateMatch = line.match(/(\d{2}[-\/]\d{2}[-\/]\d{4})/)
        if (dateMatch) {
          const dateStr = dateMatch[1].replace(/-/g, '/')
          const parsedDate = parseDate(dateStr)
          // Verificar que sea una fecha futura respecto a la fecha de factura (generalmente las fechas de vencimiento son futuras)
          if (parsedDate && parsedDate > result.invoiceDate) {
            result.dueDate = parsedDate
            logger.info(`Fecha de vencimiento encontrada (después de fecha factura) en línea ${i}: ${dateStr}`)
            break
          }
        }
      }
    }
  }

  // 4. Buscar importe total
  logger.info('=== BUSCANDO MONTO TOTAL ===')
  // Buscar específicamente el total final, que generalmente está al final de la factura
  // Primero buscar todas las líneas que contengan "TOTAL" y analizar cuál es el total final
  const totalCandidates = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineLower = line.toLowerCase()
    
    // Buscar líneas que contengan "TOTAL" pero excluir subtotales e impuestos
    if (lineLower.includes('total') && 
        !lineLower.includes('subtotal') && 
        !lineLower.includes('iva') &&
        !lineLower.includes('pibbb') &&
        !lineLower.includes('ingresos brutos') &&
        !lineLower.includes('bonif') &&
        !lineLower.includes('dto')) {
      totalCandidates.push({ index: i, line: line })
      logger.info(`Línea ${i} con TOTAL encontrada: ${line}`)
    }
  }
  
  // Si encontramos candidatos, buscar el total más grande cerca de ellos
  if (totalCandidates.length > 0) {
    // Preferir el último candidato (el total final generalmente está al final)
    const lastCandidate = totalCandidates[totalCandidates.length - 1]
    const i = lastCandidate.index
    
    logger.info(`Analizando candidato de TOTAL en línea ${i}: ${lastCandidate.line}`)
    
    // Buscar número grande en esta línea y en las siguientes 15 líneas (el total puede estar más abajo)
    let searchLines = []
    for (let j = 0; j <= 15; j++) {
      if (i + j < lines.length) {
        const searchLine = lines[i + j]
        searchLines.push({ line: searchLine, index: i + j })
        logger.info(`Línea ${i + j} (después de TOTAL): ${searchLine}`)
      }
    }
    
    // También buscar en líneas anteriores (a veces el total está antes de la palabra TOTAL)
    for (let j = 1; j <= 3; j++) {
      if (i - j >= 0) {
        const searchLine = lines[i - j]
        searchLines.unshift({ line: searchLine, index: i - j })
        logger.info(`Línea ${i - j} (antes de TOTAL): ${searchLine}`)
      }
    }
    
    const allNumbers = []
    for (const { line: searchLine, index: lineIndex } of searchLines) {
      // Buscar números con formato argentino: puede tener puntos para miles y coma para decimales
      const numbers = searchLine.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)/g)
      if (numbers) {
        numbers.forEach(num => {
          allNumbers.push({ num, lineIndex, line: searchLine })
        })
      }
    }
    
    if (allNumbers.length > 0) {
      logger.info(`Números encontrados en líneas TOTAL: ${allNumbers.map(n => `${n.num} (línea ${n.lineIndex})`).join(', ')}`)
      
      // Convertir todos los números y filtrar por tamaño razonable
      const amounts = allNumbers
        .map(({ num, lineIndex, line }) => {
          // Parsear formato argentino: puntos para miles, coma para decimales
          const cleaned = num.replace(/\./g, '').replace(',', '.')
          const parsed = parseFloat(cleaned) || 0
          logger.info(`Parseando número: ${num} (línea ${lineIndex}) -> ${parsed}`)
          return { amount: parsed, lineIndex, line, original: num }
        })
        .filter(({ amount }) => amount > 50000 && amount < 100000000) // Filtrar números grandes (más de 50,000)
        .sort((a, b) => b.amount - a.amount) // Ordenar de mayor a menor
      
      logger.info(`Montos parseados (después de filtrar > 50000): ${amounts.map(a => `${a.amount} (línea ${a.lineIndex})`).join(', ')}`)
      
      if (amounts.length > 0) {
        // Preferir el número más grande que esté después de la palabra TOTAL
        const afterTotal = amounts.filter(a => a.lineIndex >= i)
        if (afterTotal.length > 0) {
          result.totalAmount = afterTotal[0].amount
          logger.info(`Monto total seleccionado (después de TOTAL): ${result.totalAmount} de línea ${afterTotal[0].lineIndex}`)
        } else {
          result.totalAmount = amounts[0].amount
          logger.info(`Monto total seleccionado (más grande encontrado): ${result.totalAmount} de línea ${amounts[0].lineIndex}`)
        }
      } else {
        logger.warn(`No se encontraron montos válidos (> 50000) cerca de TOTAL. Todos los números: ${allNumbers.map(n => n.num).join(', ')}`)
      }
    } else {
      logger.warn(`No se encontraron números en las líneas TOTAL`)
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
    
    // NUEVA ESTRATEGIA: El OCR divide las columnas en líneas separadas
    // Necesitamos agrupar líneas consecutivas para reconstruir las filas de productos
    // Detectar la sección de productos buscando encabezados de columna (MARCA, CODIGO, ARTICULO, etc.)
    
    let tableHeaderFound = false
    let tableStartIndex = -1
    
    // Buscar encabezados de tabla - múltiples estructuras posibles
    // Estructura 1: MARCA, CODIGO, ARTICULO, CANT, P. UNIT, DTO, TOTAL
    // Estructura 2: CANT., ARTICULO, DESCRIPCION, DESP. IMP., PRECIO UNIT., IMPORTE
    // Estructura 3: CANT, ARTICULO, DESCRIPCION, PRECIO UNIT., IMPORTE
    
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase()
      const line = lines[i]
      
      // Estructura 1: MARCA + CODIGO + ARTICULO
      if (lineLower.includes('marca') && lineLower.includes('codigo') && lineLower.includes('articulo')) {
        tableHeaderFound = true
        tableStartIndex = i + 1
        logger.info(`Encabezado de tabla encontrado (estructura 1) en línea ${i}: ${line}`)
        break
      }
      
      // Estructura 2: CANT + ARTICULO + DESCRIPCION + PRECIO UNIT + IMPORTE
      if ((lineLower.includes('cant') || lineLower.includes('cant.')) && 
          (lineLower.includes('articulo') || lineLower.includes('artículo')) &&
          (lineLower.includes('descripcion') || lineLower.includes('descripción')) &&
          (lineLower.includes('precio unit') || lineLower.includes('precio unit.') || lineLower.includes('importe'))) {
        tableHeaderFound = true
        tableStartIndex = i + 1
        logger.info(`Encabezado de tabla encontrado (estructura 2) en línea ${i}: ${line}`)
        break
      }
      
      // Estructura 3: CANT + ARTICULO + DESCRIPCION (más flexible)
      if ((lineLower.includes('cant') || lineLower.includes('cant.')) && 
          (lineLower.includes('articulo') || lineLower.includes('artículo')) &&
          (lineLower.includes('descripcion') || lineLower.includes('descripción'))) {
        // Verificar que las siguientes líneas tengan números (productos)
        let hasProductsAfter = false
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j].match(/\d{1,3}(?:\.\d{3})+(?:,\d{2})?/)) {
            hasProductsAfter = true
            break
          }
        }
        if (hasProductsAfter) {
          tableHeaderFound = true
          tableStartIndex = i + 1
          logger.info(`Encabezado de tabla encontrado (estructura 3) en línea ${i}: ${line}`)
          break
        }
      }
    }
    
    // Si encontramos el encabezado, buscar las columnas individuales (método alternativo)
    if (!tableHeaderFound) {
      for (let i = 0; i < lines.length; i++) {
        const lineLower = lines[i].toLowerCase()
        // Buscar cualquier combinación de encabezados comunes
        if (lineLower === 'marca' || lineLower === 'codigo' || lineLower === 'articulo' ||
            lineLower === 'cant' || lineLower === 'cant.' || 
            lineLower === 'descripcion' || lineLower === 'descripción' ||
            lineLower === 'precio unit' || lineLower === 'precio unit.' ||
            lineLower === 'importe' || lineLower === 'total') {
          // Buscar si las siguientes líneas contienen los otros encabezados
          let foundHeaders = [lineLower]
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const nextLineLower = lines[j].toLowerCase().trim()
            if (nextLineLower === 'cant' || nextLineLower === 'cant.' ||
                nextLineLower === 'p. unit' || nextLineLower === 'precio unit' || nextLineLower === 'precio unit.' ||
                nextLineLower === 'dto' || nextLineLower === 'total' || 
                nextLineLower === 'articulo' || nextLineLower === 'artículo' ||
                nextLineLower === 'codigo' || nextLineLower === 'código' ||
                nextLineLower === 'descripcion' || nextLineLower === 'descripción' ||
                nextLineLower === 'importe' || nextLineLower === 'marca') {
              foundHeaders.push(nextLineLower)
            }
          }
          if (foundHeaders.length >= 3) {
            tableHeaderFound = true
            tableStartIndex = i + 10 // Empezar después de los encabezados
            logger.info(`Encabezados de tabla encontrados alrededor de línea ${i}: ${foundHeaders.join(', ')}`)
            break
          }
        }
      }
    }
    
    // Si encontramos la tabla, procesar agrupando líneas - ESTRATEGIA GENÉRICA
    if (tableHeaderFound && tableStartIndex > 0) {
      logger.info(`Procesando tabla de productos desde línea ${tableStartIndex} con agrupación de líneas`)
      
      const parseArgentineNumber = (numStr) => {
        if (!numStr) return 0
        const cleaned = numStr.trim().replace(/\$/g, '').replace(/\./g, '').replace(',', '.')
        return parseFloat(cleaned) || 0
      }
      
      // ESTRATEGIA GENÉRICA: Buscar grupos de líneas consecutivas que formen productos
      // Un producto típicamente tiene: cantidad (número pequeño), código/artículo (número o texto), 
      // descripción (texto largo), precio unitario (número grande), importe/total (número grande)
      
      const processedProducts = new Set()
      let i = tableStartIndex
      
      // Buscar el final de la sección de productos (antes de subtotales/totales)
      let productSectionEnd = lines.length
      for (let j = tableStartIndex; j < lines.length; j++) {
        const lineLower = lines[j].toLowerCase()
        if (lineLower.includes('subtotal') || 
            (lineLower.includes('total') && !lineLower.includes('importe') && !lineLower.includes('precio')) ||
            lineLower.includes('iva') ||
            lineLower.includes('importe en letras') ||
            lineLower.includes('observaciones')) {
          productSectionEnd = j
          break
        }
      }
      
      logger.info(`Sección de productos: líneas ${tableStartIndex} a ${productSectionEnd}`)
      
      // Agrupar líneas consecutivas que puedan formar productos
      // Buscar patrones: número pequeño (cantidad) + texto (descripción) + números grandes (precios)
      while (i < productSectionEnd) {
        const line = lines[i]
        const lineLower = line.toLowerCase()
        
        // Excluir líneas que claramente NO son productos
        if (lineLower.includes('flete') ||
            lineLower.includes('forma de pago') ||
            lineLower.includes('metodo de pago') ||
            lineLower.includes('importe en letras') ||
            lineLower.includes('observaciones') ||
            lineLower.includes('estimado cliente') ||
            lineLower.includes('ud dispone') ||
            lineLower.includes('nro. caea') ||
            lineLower.includes('fecha de vto') ||
            lineLower === 'bonif' ||
            lineLower === 'dto' ||
            (lineLower === 'total' && !lineLower.includes('importe')) ||
            lineLower === '$' ||
            lineLower.includes('subtotal') ||
            lineLower.includes('iva')) {
          i++
          continue
        }
        
        // Buscar líneas con números grandes (precios totales o unitarios)
        const largeNumberMatch = line.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)/)
        if (largeNumberMatch) {
          const priceValue = parseArgentineNumber(largeNumberMatch[1])
          
          // Filtrar precios razonables de productos (entre 100 y 200000)
          // Ajustado para capturar productos más baratos y evitar totales de factura
          // Los productos individuales generalmente están entre 100 y 200000
          if (priceValue >= 100 && priceValue < 200000) {
            logger.info(`Línea ${i} contiene precio posible de producto: ${largeNumberMatch[1]} -> ${priceValue}`)
            
            // Buscar hacia atrás (hasta 8 líneas) para encontrar todos los componentes del producto
            let cantidad = 1
            let codigo = null
            let marca = null
            let descripcion = null
            let precioUnitario = null
            let totalPrice = priceValue
            
            // Buscar cantidad (número pequeño 1-2 dígitos)
            for (let j = Math.max(i - 8, tableStartIndex); j < i; j++) {
              const qtyLine = lines[j].trim()
              if (/^\d{1,2}$/.test(qtyLine)) {
                const qty = parseInt(qtyLine)
                if (qty >= 1 && qty <= 100) {
                  cantidad = qty
                  logger.info(`Cantidad encontrada en línea ${j}: ${cantidad}`)
                  break
                }
              }
            }
            
            // Buscar precio unitario (número grande cerca del total, generalmente antes)
            // Buscar en un rango más amplio para encontrar el precio unitario
            // IMPORTANTE: El precio unitario debe estar ANTES del precio total y ser similar o igual
            for (let j = Math.max(i - 8, tableStartIndex); j < i; j++) {
              const prevLine = lines[j].trim()
              const prevLineLower = prevLine.toLowerCase().trim()
              
              // Excluir encabezados y líneas que no son precios
              const isPriceHeader = prevLineLower === 'precio unit' ||
                                   prevLineLower === 'precio unit.' ||
                                   prevLineLower === 'p. unit' ||
                                   prevLineLower === 'importe' ||
                                   prevLineLower === 'desp. imp.' ||
                                   prevLineLower === 'descripcion' ||
                                   prevLineLower === 'descripción' ||
                                   prevLineLower === 'cant' ||
                                   prevLineLower === 'cant.' ||
                                   prevLineLower === 'articulo' ||
                                   prevLineLower === 'artículo'
              
              if (isPriceHeader) {
                continue
              }
              
              const prevNumberMatch = prevLine.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)/)
              if (prevNumberMatch) {
                const prevPrice = parseArgentineNumber(prevNumberMatch[1])
                // El precio unitario debe ser razonable y similar al total (para cantidad 1, debería ser igual o muy cercano)
                // Si cantidad > 1, el precio unitario debería ser menor que el total
                const expectedUnitPrice = cantidad > 1 ? totalPrice / cantidad : totalPrice
                const priceDiff = Math.abs(prevPrice - expectedUnitPrice)
                const priceDiffPercent = (priceDiff / expectedUnitPrice) * 100
                
                // Aceptar si el precio está dentro del rango razonable y es similar al esperado
                if (prevPrice >= 100 && 
                    prevPrice < 500000 &&
                    (cantidad === 1 ? priceDiffPercent < 10 : prevPrice <= totalPrice * 1.1)) {
                  precioUnitario = prevPrice
                  logger.info(`✅ Precio unitario encontrado en línea ${j}: ${prevNumberMatch[1]} -> ${precioUnitario} (esperado: ~${expectedUnitPrice.toFixed(2)})`)
                  break
                }
              }
            }
            
            // Si no encontramos precio unitario, calcularlo del total
            if (!precioUnitario) {
              precioUnitario = totalPrice / cantidad
              logger.info(`Precio unitario calculado: ${totalPrice} / ${cantidad} = ${precioUnitario}`)
            }
            
            // Buscar descripción (texto largo con letras, no solo números)
            // Buscar desde más cerca hacia atrás
            for (let j = i - 1; j >= Math.max(i - 10, tableStartIndex); j--) {
              const prevLine = lines[j].trim()
              const prevLineLower = prevLine.toLowerCase().trim()
              
              // Excluir encabezados de columna comunes (comparación exacta primero)
              const isHeader = prevLineLower === 'descripcion' || 
                              prevLineLower === 'descripción' ||
                              prevLineLower === 'desp. imp.' ||
                              prevLineLower === 'desp imp' ||
                              prevLineLower === 'precio unit.' ||
                              prevLineLower === 'precio unit' ||
                              prevLineLower === 'p. unit' ||
                              prevLineLower === 'importe' ||
                              prevLineLower === 'cant' ||
                              prevLineLower === 'cant.' ||
                              prevLineLower === 'articulo' ||
                              prevLineLower === 'artículo' ||
                              prevLineLower === 'marca' ||
                              prevLineLower === 'codigo' ||
                              prevLineLower === 'código' ||
                              prevLineLower === 'dto' ||
                              prevLineLower === 'bonif' ||
                              prevLineLower === 'total'
              
              if (isHeader) {
                logger.info(`Línea ${j} es encabezado de columna, ignorando: ${prevLine}`)
                continue
              }
              
              // Verificar que sea una descripción válida
              if (prevLine.length > 5 && 
                  prevLine.length < 120 &&
                  /[A-ZÁÉÍÓÚÑ]/.test(prevLine) &&
                  !prevLine.match(/^\d+$/) &&
                  !prevLine.match(/^\d{1,3}(?:\.\d{3})+(?:,\d{2})?$/) &&
                  !prevLine.match(/^\d+%$/) &&
                  !prevLine.match(/^\$+$/) &&
                  !prevLineLower.includes('precio') &&
                  !prevLineLower.includes('importe') &&
                  !prevLineLower.includes('total') &&
                  !prevLineLower.includes('subtotal') &&
                  !prevLineLower.includes('iva') &&
                  !prevLineLower.includes('flete') &&
                  !prevLineLower.includes('cliente') &&
                  !prevLineLower.includes('vendedor')) {
                // Preferir la descripción más larga y completa
                if (!descripcion || (prevLine.length > descripcion.length && prevLine.length > 10)) {
                  descripcion = prevLine
                  logger.info(`Descripción encontrada en línea ${j}: ${descripcion}`)
                }
              }
            }
            
            // Buscar código/artículo - ESTRATEGIA MEJORADA
            // PRIORIDAD 1: Extraer código de la descripción si contiene números al inicio
            if (descripcion) {
              // Patrón mejorado: código numérico o alfanumérico al inicio de la descripción
              // Ejemplo: "62547 RAD.CALEF.VW GOL" -> código: "62547", descripción: "RAD.CALEF.VW GOL"
              const codeAtStartMatch = descripcion.match(/^(\d{3,}|[A-Z0-9]{3,25})\s+(.+)$/)
              if (codeAtStartMatch) {
                const potentialCode = codeAtStartMatch[1].trim()
                const remainingDesc = codeAtStartMatch[2].trim()
                
                // Verificar que el código potencial no sea un encabezado
                const potentialCodeLower = potentialCode.toLowerCase().trim()
                const isHeaderCode = potentialCodeLower === 'descripcion' ||
                                    potentialCodeLower === 'descripción' ||
                                    potentialCodeLower === 'desp' ||
                                    potentialCodeLower === 'desp. imp.' ||
                                    potentialCodeLower === 'cant' ||
                                    potentialCodeLower === 'articulo' ||
                                    potentialCodeLower === 'marca' ||
                                    potentialCodeLower === 'codigo'
                
                if (!isHeaderCode &&
                    potentialCode.length >= 3 && 
                    potentialCode.length <= 25 && 
                    remainingDesc.length > 5) {
                  codigo = potentialCode
                  descripcion = remainingDesc // Actualizar descripción sin el código
                  logger.info(`✅ Código extraído del inicio de descripción: ${codigo}, nueva descripción: ${descripcion}`)
                }
              }
            }
            
            // PRIORIDAD 2: Extraer marca de la descripción si está presente
            // Buscar marcas comunes de autos en la descripción (VW, FORD, CHEV, RENAULT, etc.)
            if (descripcion && !marca) {
              const marcaPatterns = [
                /\b(VW|FORD|CHEV|CHEVROLET|RENAULT|FIAT|PEUGEOT|CITROEN|TOYOTA|HONDA|NISSAN|HYUNDAI|KIA|BMW|MERCEDES|AUDI|VOLVO|OPEL|SEAT|SKODA)\b/i,
                /\b(MD|ELIFEL|BOSCH|VALEO|DELPHI|DENSO|NGK|CHAMPION|MANN|MAHLE|KNECHT|FRAM)\b/i,
              ]
              
              for (const pattern of marcaPatterns) {
                const marcaMatch = descripcion.match(pattern)
                if (marcaMatch) {
                  marca = marcaMatch[1].toUpperCase()
                  logger.info(`Marca extraída de descripción: ${marca}`)
                  break
                }
              }
            }
            
            // PRIORIDAD 3: Si no encontramos código en la descripción, buscar en líneas anteriores
            // IMPORTANTE: Excluir explícitamente "DESCRIPCION" y otros encabezados
            if (!codigo && descripcion) {
              const descIndex = lines.findIndex((l, idx) => idx < i && l.trim() === descripcion)
              if (descIndex > 0) {
                // Buscar código en líneas anteriores a la descripción
                for (let j = Math.max(descIndex - 5, tableStartIndex); j < descIndex; j++) {
                  const codeLine = lines[j].trim()
                  const codeLineLower = codeLine.toLowerCase().trim()
                  
                  // EXCLUIR EXPLÍCITAMENTE encabezados comunes (comparación exacta primero)
                  const isHeaderCode = codeLineLower === 'cant' ||
                                      codeLineLower === 'cant.' ||
                                      codeLineLower === 'articulo' ||
                                      codeLineLower === 'artículo' ||
                                      codeLineLower === 'marca' ||
                                      codeLineLower === 'codigo' ||
                                      codeLineLower === 'código' ||
                                      codeLineLower === 'descripcion' ||
                                      codeLineLower === 'descripción' ||
                                      codeLineLower === 'desp. imp.' ||
                                      codeLineLower === 'desp imp' ||
                                      codeLineLower === 'precio unit' ||
                                      codeLineLower === 'precio unit.' ||
                                      codeLineLower === 'p. unit' ||
                                      codeLineLower === 'importe' ||
                                      codeLineLower === 'bonif' ||
                                      codeLineLower === 'dto' ||
                                      codeLineLower === 'total'
                  
                  if (isHeaderCode) {
                    logger.info(`Línea ${j} excluida como encabezado: "${codeLine}"`)
                    continue
                  }
                  
                  // Buscar código: número de 3+ dígitos o alfanumérico corto
                  // EXCLUIR explícitamente si contiene palabras de encabezado
                  if ((/^\d{3,}$/.test(codeLine) || /^[A-Z0-9\s\-]{3,25}$/.test(codeLine)) &&
                      codeLine.length < 30 &&
                      !codeLineLower.includes('marca') &&
                      !codeLineLower.includes('codigo') &&
                      !codeLineLower.includes('descripcion') &&
                      !codeLineLower.includes('desp') &&
                      !codeLineLower.includes('precio') &&
                      !codeLineLower.includes('importe')) {
                    codigo = codeLine
                    logger.info(`✅ Código encontrado en línea separada ${j}: ${codigo}`)
                    break
                  }
                }
              }
            }
            
            // Buscar marca - PRIORIDAD 1: Extraer de la descripción si está presente
            if (descripcion && !marca) {
              // Buscar marcas comunes de autos en la descripción (VW, FORD, CHEV, RENAULT, etc.)
              const marcaPatterns = [
                /\b(VW|FORD|CHEV|CHEVROLET|RENAULT|FIAT|PEUGEOT|CITROEN|TOYOTA|HONDA|NISSAN|HYUNDAI|KIA|BMW|MERCEDES|AUDI|VOLVO|OPEL|SEAT|SKODA)\b/i,
                /\b(MD|ELIFEL|BOSCH|VALEO|DELPHI|DENSO|NGK|CHAMPION|MANN|MAHLE|KNECHT|FRAM)\b/i,
              ]
              
              for (const pattern of marcaPatterns) {
                const marcaMatch = descripcion.match(pattern)
                if (marcaMatch) {
                  marca = marcaMatch[1].toUpperCase()
                  logger.info(`✅ Marca extraída de descripción: ${marca}`)
                  break
                }
              }
            }
            
            // PRIORIDAD 2: Buscar marca en línea separada antes del código
            if (!marca && codigo) {
              const codeIndex = lines.findIndex((l, idx) => idx < i && l.trim() === codigo)
              if (codeIndex > 0) {
                for (let j = Math.max(codeIndex - 3, tableStartIndex); j < codeIndex; j++) {
                  const marcaLine = lines[j].trim()
                  const marcaLineLower = marcaLine.toLowerCase().trim()
                  
                  // Excluir encabezados
                  if (marcaLineLower === 'marca' ||
                      marcaLineLower === 'codigo' ||
                      marcaLineLower === 'cant' ||
                      marcaLineLower === 'articulo' ||
                      marcaLineLower === 'descripcion') {
                    continue
                  }
                  
                  // Buscar marca: texto corto en mayúsculas
                  if (/^[A-ZÁÉÍÓÚÑ]{2,15}$/.test(marcaLine) &&
                      marcaLine.length < 20) {
                    marca = marcaLine
                    logger.info(`✅ Marca encontrada en línea separada ${j}: ${marca}`)
                    break
                  }
                }
              }
            }
            
            // Buscar cantidad (número pequeño 1-2 dígitos cerca del precio unitario)
            for (let j = Math.max(i - 5, tableStartIndex); j < i; j++) {
              const qtyLine = lines[j].trim()
              if (/^\d{1,2}$/.test(qtyLine)) {
                const qty = parseInt(qtyLine)
                if (qty >= 1 && qty <= 100) {
                  cantidad = qty
                  logger.info(`Cantidad encontrada en línea ${j}: ${cantidad}`)
                  break
                }
              }
            }
            
            // Si encontramos datos suficientes, crear el producto
            // Aceptar si tenemos descripción y precio total válido (ajustado para productos más baratos)
            if (descripcion && totalPrice >= 100) {
              // Limpiar la descripción: remover código si está incluido al inicio
              let cleanDescription = descripcion.trim()
              
              // Si la descripción empieza con el código, removerlo
              if (codigo && cleanDescription.startsWith(codigo)) {
                cleanDescription = cleanDescription.substring(codigo.length).trim()
              }
              
              // Remover palabras como "DESCRIPCION" si aparecen al inicio
              cleanDescription = cleanDescription.replace(/^DESCRIPCION\s+/i, '').trim()
              
              // Remover marca si está al inicio de la descripción (ya la tenemos separada)
              if (marca && cleanDescription.toUpperCase().startsWith(marca)) {
                cleanDescription = cleanDescription.substring(marca.length).trim()
              }
              
              // El nombre del producto es SOLO la descripción limpia (sin código ni marca)
              const productName = cleanDescription
              
              // Verificar que no sea un elemento excluido
              const productNameLower = productName.toLowerCase()
              if (productNameLower.includes('flete') ||
                  productNameLower.includes('forma de pago') ||
                  productNameLower.includes('metodo de pago') ||
                  productNameLower.includes('importe en letras') ||
                  productNameLower.includes('observaciones') ||
                  productNameLower.includes('bonif') ||
                  productNameLower === 'dto' ||
                  productNameLower.includes('subtotal') ||
                  productNameLower.includes('iva') ||
                  productNameLower.includes('total') && !productNameLower.includes('importe')) {
                logger.warn(`❌ Producto excluido: "${productName}"`)
                i++
                continue
              }
              
              // Crear clave única para el producto
              const productKey = codigo ? `${productNameLower}_${codigo}` : productNameLower
              
              // Verificar si ya procesamos este producto
              if (processedProducts.has(productKey)) {
                logger.info(`⏭️ Producto ya procesado, ignorando duplicado: "${productName}"`)
                i++
                continue
              }
              
              // Verificar si ya existe un producto con la misma descripción
              const existingProductIndex = result.items.findIndex(item => 
                item.item_name.toLowerCase() === productNameLower ||
                (codigo && item.description && item.description.includes(codigo))
              )
              
              if (existingProductIndex >= 0) {
                const existingQty = result.items[existingProductIndex].quantity
                if (cantidad && cantidad !== existingQty) {
                  result.items[existingProductIndex].quantity = cantidad
                  logger.info(`🔄 Producto existente actualizado: "${productName}" - Nueva Cant: ${cantidad}`)
                } else {
                  logger.info(`⏭️ Producto duplicado ignorado: "${productName}"`)
                }
                processedProducts.add(productKey)
              } else {
                // Calcular precio unitario si no se encontró
                const finalUnitPrice = precioUnitario || (totalPrice / (cantidad || 1))
                
                result.items.push({
                  item_name: productName, // Solo descripción limpia
                  quantity: cantidad || 1,
                  unit_price: finalUnitPrice,
                  total_price: totalPrice,
                  description: codigo ? `Código: ${codigo}` : null, // Código separado en description
                  brand: marca || null, // Marca del producto
                })
                processedProducts.add(productKey)
                logger.info(`✅ Producto encontrado: "${productName}" - Cant: ${cantidad || 1}, Precio Unit: ${finalUnitPrice}, Total: ${totalPrice}, Código: ${codigo || 'N/A'}, Marca: ${marca || 'N/A'}`)
                
                // Avanzar líneas para evitar procesar el mismo producto múltiples veces
                i += 3
                continue
              }
            } else {
              logger.warn(`❌ Producto incompleto - Desc: ${descripcion || 'N/A'}, PrecioUnit: ${precioUnitario || 'N/A'}, Total: ${totalPrice}`)
            }
          }
        }
        
        i++
      }
    } else {
      // Fallback: buscar productos línea por línea (código anterior)
      logger.info('No se encontró encabezado de tabla, usando método de búsqueda línea por línea')
      
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
        
        // Loggear TODAS las líneas en el rango de productos para debugging completo
        if (i >= 38 && i <= 70) {
          logger.info(`Línea ${i} completa: "${line}"`)
        }
        
        // Excluir líneas que claramente NO son productos:
        if (/^\d{2,4}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(line) || 
            /^-\w+-\d+/.test(line) ||
            /^\d+$/.test(line.trim()) ||
            lineLower.includes('chiaia') ||
            lineLower.includes('fabian')) {
          continue
        }
        
        // Patrón 1 ROBUSTO: MARCA CODIGO ARTICULO CANT P.UNIT DTO TOTAL
        // Basado en el formato exacto de la factura: "MD 24703 BULBO CHEV. CORSA 1 $ 17.083,90 46% $ 9.225,31"
        // O: "ELIFEL ROM 210 ELECTROBOMBA VW. GOL 2 $ 51.177,39 46% $ 55.271,58"
        // Este patrón busca específicamente líneas con estructura de tabla de productos
        // Formato: MARCA (2-15 chars) + CODIGO (numérico o alfanumérico con espacios) + ARTICULO (descripción) + CANT + P.UNIT ($ opcional) + DTO (% opcional) + TOTAL ($ opcional)
        
        // Estrategia: buscar líneas que tengan al menos 2 números grandes (precio unitario y total)
        // y que tengan estructura: texto_corto + texto_medio + texto_largo + número_pequeño + número_grande + porcentaje_opcional + número_grande
        
        // Primero, buscar si la línea tiene la estructura básica: texto + números grandes
        const hasLargeNumbers = line.match(/\d{1,3}(?:\.\d{3})+(?:,\d{2})?/g)
        let match1 = null
        
        if (hasLargeNumbers && hasLargeNumbers.length >= 2) {
          // Buscar patrón específico de tabla: MARCA + CODIGO + ARTICULO + CANT + P.UNIT + DTO + TOTAL
          // Patrón principal: maneja códigos numéricos y alfanuméricos, símbolo $ opcional
          const tablePattern1 = /^([A-ZÁÉÍÓÚÑ]{2,15})\s+([A-Z0-9\s\-]{3,20})\s+([A-ZÁÉÍÓÚÑ\s\.\-]{5,80})\s+(\d{1,2})\s+\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)\s*(?:\d+(?:\.\d+)?%)?\s+\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)$/
          match1 = line.match(tablePattern1)
          
          // Patrón alternativo: sin símbolo $, más flexible con espacios
          if (!match1) {
            const tablePattern1Alt = /^([A-ZÁÉÍÓÚÑ]{2,15})\s+([A-Z0-9\s\-]{3,20})\s+([A-ZÁÉÍÓÚÑ\s\.\-]{5,80})\s+(\d{1,2})\s+(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)\s*(?:\d+(?:\.\d+)?%)?\s+(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)$/
            match1 = line.match(tablePattern1Alt)
          }
          
          // Patrón alternativo 2: más flexible, permite que el código y la descripción se mezclen un poco
          if (!match1) {
            const tablePattern1Alt2 = /^([A-ZÁÉÍÓÚÑ]{2,15})\s+([A-Z0-9\s\-]{3,25})\s+([A-ZÁÉÍÓÚÑ\s\.\-]{5,80})\s+(\d{1,2})\s+\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)\s*(?:\d+(?:\.\d+)?%)?\s+\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)$/
            match1 = line.match(tablePattern1Alt2)
          }
          
          // Si encontramos el patrón, procesarlo
          if (match1) {
            logger.info(`Línea ${i} coincide con patrón 1 (tabla de productos): ${line.substring(0, 150)}`)
            const [, marca, codigo, descripcion, cantidad, precioUnitStr, totalStr] = match1
          
            const parseArgentineNumber = (numStr) => {
              if (!numStr) return 0
              // Remover símbolo $, puntos (separadores de miles) y reemplazar coma por punto para decimales
              const cleaned = numStr.trim().replace(/\$/g, '').replace(/\./g, '').replace(',', '.')
              return parseFloat(cleaned) || 0
            }
            
            // Limpiar y validar código (puede ser numérico o alfanumérico)
            const codigoLimpio = codigo.trim()
            
            // Validar que el código tenga sentido (no sea solo espacios o muy corto)
            if (codigoLimpio.length < 2) {
              logger.warn(`Código inválido en línea ${i}: "${codigoLimpio}"`)
              continue
            }
            
            const qty = parseFloat(cantidad) || 1
            const unitPrice = parseArgentineNumber(precioUnitStr)
            const totalPrice = parseArgentineNumber(totalStr)
            
            logger.info(`Patrón 1 parseado - Marca: "${marca.trim()}", Código: "${codigoLimpio}", Desc: "${descripcion.trim()}", Cant: ${qty}, PrecioUnit: "${precioUnitStr}" -> ${unitPrice}, Total: "${totalStr}" -> ${totalPrice}`)
            
            // Validar que los precios sean razonables para productos de repuestos automotrices
            // Precio unitario mínimo: 100 (productos muy baratos) o si el total es alto
            // Precio unitario máximo: 10,000,000 (productos muy caros pero posibles)
            const isValidUnitPrice = (unitPrice >= 100 && unitPrice < 10000000) || 
                                    (unitPrice >= 50 && unitPrice < 100 && totalPrice >= 1000)
            const isValidTotalPrice = totalPrice >= 100 && totalPrice < 10000000
            
            // Validar que la descripción tenga sentido (no sea solo números, fechas, o nombres)
            const descripcionLimpia = descripcion.trim()
            const isValidDescription = descripcionLimpia.length >= 5 &&
                                      !descripcionLimpia.match(/^\d+$/) &&
                                      !descripcionLimpia.match(/^\d{2}\/\d{2}\/\d{4}/) &&
                                      !descripcionLimpia.toLowerCase().includes('chiaia') &&
                                      !descripcionLimpia.toLowerCase().includes('fabian') &&
                                      !descripcionLimpia.toLowerCase().includes('vendedor') &&
                                      !descripcionLimpia.toLowerCase().includes('cliente')
            
            if (isValidUnitPrice && isValidTotalPrice && isValidDescription && qty > 0 && qty <= 1000) {
              // Limpiar descripción: remover código si está al inicio
              let cleanDescription = descripcionLimpia.trim()
              if (codigoLimpio && cleanDescription.startsWith(codigoLimpio)) {
                cleanDescription = cleanDescription.substring(codigoLimpio.length).trim()
              }
              cleanDescription = cleanDescription.replace(/^DESCRIPCION\s+/i, '').trim()
              
              // El nombre es SOLO la descripción (sin marca ni código)
              const productName = cleanDescription
              
              result.items.push({
                item_name: productName,
                quantity: qty,
                unit_price: unitPrice,
                total_price: totalPrice > 0 ? totalPrice : (qty * unitPrice),
                description: codigoLimpio ? `Código: ${codigoLimpio}` : null,
                brand: marca ? marca.trim() : null, // Marca del producto
              })
              logger.info(`✅ Producto encontrado (patrón 1): "${productName}" - Cant: ${qty}, Precio Unit: ${unitPrice}, Total: ${totalPrice}, Código: ${codigoLimpio}`)
              continue
            } else {
              logger.warn(`❌ Producto rechazado (patrón 1) - Desc: "${descripcionLimpia}", Precio: ${unitPrice}, Total: ${totalPrice}, isValidUnitPrice: ${isValidUnitPrice}, isValidTotalPrice: ${isValidTotalPrice}, isValidDescription: ${isValidDescription}`)
            }
          }
        }
        
        // Patrón 2: DESCRIPCION CANT PRECIO TOTAL (sin marca/código)
        // Mejorado para capturar números con formato argentino (puntos para miles)
        // Más flexible: permite espacios variables y números con formato argentino
        const tablePattern2 = /^([A-ZÁÉÍÓÚÑ\s\.\-]{5,80})\s+(\d{1,2})\s+(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)\s+(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)$/
        const match2 = line.match(tablePattern2)
      
        if (match2) {
          const [, descripcion, cantidad, precioUnitStr, totalStr] = match2
          
          // Verificar que la descripción no sea solo números, fechas, o nombres de personas
          if (!/^\d+$/.test(descripcion.trim()) && 
              !/^\d{2}\/\d{2}\/\d{4}/.test(descripcion.trim()) &&
              !/^\d{2,4}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(descripcion.trim()) &&
              descripcion.trim().length > 3) {
            const parseArgentineNumber = (numStr) => {
              if (!numStr) return 0
              const cleaned = numStr.trim().replace(/\./g, '').replace(',', '.')
              return parseFloat(cleaned) || 0
            }
            
            const qty = parseFloat(cantidad) || 1
            const unitPrice = parseArgentineNumber(precioUnitStr)
            const totalPrice = parseArgentineNumber(totalStr)
            
            logger.info(`Patrón 2 parseado - Desc: ${descripcion.trim()}, Cant: ${qty}, PrecioUnit: ${precioUnitStr} -> ${unitPrice}, Total: ${totalStr} -> ${totalPrice}`)
            
            // Validar que los precios sean razonables (reducir mínimo a 100)
            const isValidPrice = (unitPrice >= 100 && unitPrice < 10000000) || 
                                (unitPrice >= 50 && unitPrice < 100 && totalPrice >= 1000)
            
            if (isValidPrice && totalPrice >= 100 && totalPrice < 10000000) {
              result.items.push({
                item_name: descripcion.trim(),
                quantity: qty,
                unit_price: unitPrice,
                total_price: totalPrice || (qty * unitPrice),
                description: null,
                brand: null, // Sin marca en este patrón
              })
              logger.info(`✅ Producto encontrado (patrón 2): ${descripcion.trim()} - Cant: ${qty}, Precio: ${unitPrice}, Total: ${totalPrice}`)
              continue
            } else {
              logger.warn(`❌ Producto rechazado (patrón 2): ${descripcion.trim()} - Precio: ${unitPrice}, Total: ${totalPrice}, isValidPrice: ${isValidPrice}`)
            }
          }
        }
        
        // Patrón 2b: Buscar productos con formato: DESCRIPCION + números grandes (precio unitario y total)
        // Este patrón busca líneas que tienen texto descriptivo seguido de números grandes
        if (!match1 && !match2 && line.length > 20) {
          // Buscar si la línea tiene texto descriptivo y al menos 2 números grandes
          const largeNumbers = line.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)/g)
          if (largeNumbers && largeNumbers.length >= 2) {
            // Extraer descripción (todo antes del primer número grande)
            const firstNumberIndex = line.indexOf(largeNumbers[0])
            const descripcion = line.substring(0, firstNumberIndex).trim()
            
            // Verificar que la descripción tenga sentido
            if (descripcion.length > 5 && 
                /[A-ZÁÉÍÓÚÑ]/.test(descripcion) &&
                !descripcion.toLowerCase().includes('chiaia') &&
                !descripcion.toLowerCase().includes('fabian') &&
                !excludeKeywords.some(kw => descripcion.toLowerCase().includes(kw))) {
              
              const parseArgentineNumber = (numStr) => {
                if (!numStr) return 0
                const cleaned = numStr.trim().replace(/\./g, '').replace(',', '.')
                return parseFloat(cleaned) || 0
              }
              
              const unitPrice = parseArgentineNumber(largeNumbers[0])
              const totalPrice = parseArgentineNumber(largeNumbers[1])
              
              // Si hay un tercer número, podría ser cantidad o descuento
              const qty = largeNumbers.length >= 3 && parseFloat(largeNumbers[0].replace(/\./g, '').replace(',', '.')) < 100 
                        ? parseFloat(largeNumbers[0].replace(/\./g, '').replace(',', '.')) 
                        : 1
              
              logger.info(`Patrón 2b parseado - Desc: ${descripcion}, Cant: ${qty}, PrecioUnit: ${largeNumbers[0]} -> ${unitPrice}, Total: ${largeNumbers[1]} -> ${totalPrice}`)
              
              if (unitPrice >= 100 && unitPrice < 10000000 && totalPrice >= 100 && totalPrice < 10000000) {
                result.items.push({
                  item_name: descripcion,
                  quantity: qty,
                  unit_price: unitPrice,
                  total_price: totalPrice,
                  description: null,
                  brand: null, // Sin marca en este patrón
                })
                logger.info(`✅ Producto encontrado (patrón 2b): ${descripcion} - Cant: ${qty}, Precio: ${unitPrice}, Total: ${totalPrice}`)
                continue
              }
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
                brand: null, // Sin marca en este patrón
              })
            }
          }
        }
      }
    }
  } else {
    // Usar estrategia de agrupación de líneas también cuando encontramos productTableStart
    // porque el OCR puede fragmentar las columnas en líneas separadas
    logger.info(`Usando estrategia de agrupación de líneas desde línea ${productTableStart}`)
    
    const parseArgentineNumber = (numStr) => {
      if (!numStr) return 0
      const cleaned = numStr.trim().replace(/\$/g, '').replace(/\./g, '').replace(',', '.')
      return parseFloat(cleaned) || 0
    }
    
    // Buscar el final de la sección de productos
    let productSectionEnd = lines.length
    for (let j = productTableStart; j < lines.length; j++) {
      const lineLower = lines[j].toLowerCase()
      if (lineLower.includes('subtotal') || 
          (lineLower.includes('total') && !lineLower.includes('importe') && !lineLower.includes('precio')) ||
          lineLower.includes('iva') ||
          lineLower.includes('importe en letras') ||
          lineLower.includes('observaciones')) {
        productSectionEnd = j
        break
      }
    }
    
    logger.info(`Sección de productos: líneas ${productTableStart} a ${productSectionEnd}`)
    
    const processedProducts = new Set()
    let i = productTableStart
    
    // Primero intentar patrones de una sola línea (para facturas bien estructuradas)
    for (let i = productTableStart; i < Math.min(productTableStart + 50, productSectionEnd); i++) {
      const line = lines[i]
      const lineLower = line.toLowerCase()
      
      // Detener si encontramos totales o resúmenes
      if (lineLower.includes('subtotal') || 
          (lineLower.includes('total') && !lineLower.includes('importe') && (lineLower.includes('iva') || lineLower.includes('pibbb')))) {
        break
      }
      
      // Verificar que no sea un encabezado/metadato
      const isExcluded = excludeKeywords.some(kw => lineLower.includes(kw))
      if (isExcluded) continue
      
      // NUEVO PATRÓN ESPECÍFICO: CANTIDAD CÓDIGO DESCRIPCIÓN PRECIO_UNITARIO PRECIO_TOTAL
      // Formato: "1 62547 RAD. CALEF. VW GOL 08-> TREND $93.356,09 $93.356,09"
      // Este patrón es común en facturas donde no hay marca separada
      // PATRÓN MEJORADO: más flexible con espacios y símbolo $ opcional antes o después
      const patternCantCodigoDesc = /^(\d{1,2})\s+(\d{3,}|[A-Z0-9]{3,25})\s+([A-ZÁÉÍÓÚÑ\s\.\-\>]{5,100})\s+\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)\s+\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)$/
      let matchCantCodigoDesc = line.match(patternCantCodigoDesc)
      
      // Si no coincide, intentar patrón más flexible (permite más espacios y variaciones)
      if (!matchCantCodigoDesc) {
        const patternFlexible = /^(\d{1,2})\s+(\d{3,}|[A-Z0-9]{3,25})\s+([A-ZÁÉÍÓÚÑ\s\.\-\>]{5,120})\s+\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)\s+\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)$/
        matchCantCodigoDesc = line.match(patternFlexible)
      }
      
      // Si aún no coincide, intentar sin requerir $ (más flexible)
      if (!matchCantCodigoDesc) {
        const patternSinDolar = /^(\d{1,2})\s+(\d{3,}|[A-Z0-9]{3,25})\s+([A-ZÁÉÍÓÚÑ\s\.\-\>]{5,120})\s+(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)\s+(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)$/
        matchCantCodigoDesc = line.match(patternSinDolar)
      }
      
      // Log para debugging
      if (!matchCantCodigoDesc && line.match(/\d{1,2}\s+\d{3,}/) && line.match(/\d{1,3}(?:\.\d{3})+(?:,\d{2})?/g)?.length >= 2) {
        logger.info(`⚠️ Línea ${i} parece ser producto pero no coincide con patrón: "${line}"`)
      }
      
      if (matchCantCodigoDesc) {
        const [, cantidad, codigo, descripcion, precioUnitStr, totalStr] = matchCantCodigoDesc
        
        const parseArgentineNumber = (numStr) => {
          if (!numStr) return 0
          const cleaned = numStr.trim().replace(/\$/g, '').replace(/\./g, '').replace(',', '.')
          return parseFloat(cleaned) || 0
        }
        
        const qty = parseInt(cantidad) || 1
        const unitPrice = parseArgentineNumber(precioUnitStr)
        const totalPrice = parseArgentineNumber(totalStr)
        
        logger.info(`✅ Patrón CANT-CODIGO-DESC encontrado en línea ${i}: Cant: ${qty}, Código: ${codigo}, Desc: ${descripcion.trim()}, PrecioUnit: ${precioUnitStr} -> ${unitPrice}, Total: ${totalStr} -> ${totalPrice}`)
        
        // Validar precios
        const isValidPrice = (unitPrice >= 100 && unitPrice < 10000000) && 
                            (totalPrice >= 100 && totalPrice < 10000000)
        
        // Extraer marca de la descripción si está presente
        let marca = null
        const marcaPatterns = [
          /\b(VW|FORD|CHEV|CHEVROLET|RENAULT|FIAT|PEUGEOT|CITROEN|TOYOTA|HONDA|NISSAN|HYUNDAI|KIA|BMW|MERCEDES|AUDI|VOLVO|OPEL|SEAT|SKODA)\b/i,
          /\b(MD|ELIFEL|BOSCH|VALEO|DELPHI|DENSO|NGK|CHAMPION|MANN|MAHLE|KNECHT|FRAM)\b/i,
        ]
        
        for (const pattern of marcaPatterns) {
          const marcaMatch = descripcion.match(pattern)
          if (marcaMatch) {
            marca = marcaMatch[1].toUpperCase()
            break
          }
        }
        
        // Limpiar descripción: remover código si está al inicio y marca si está presente
        let cleanDescription = descripcion.trim()
        if (codigo && cleanDescription.startsWith(codigo)) {
          cleanDescription = cleanDescription.substring(codigo.length).trim()
        }
        if (marca && cleanDescription.toUpperCase().includes(marca)) {
          // Remover marca pero mantener el resto
          cleanDescription = cleanDescription.replace(new RegExp(`\\b${marca}\\b`, 'gi'), '').trim()
        }
        cleanDescription = cleanDescription.replace(/^DESCRIPCION\s+/i, '').trim()
        
        if (isValidPrice && cleanDescription.length > 3 && qty > 0 && qty <= 1000) {
          result.items.push({
            item_name: cleanDescription,
            quantity: qty,
            unit_price: unitPrice,
            total_price: totalPrice,
            description: codigo ? `Código: ${codigo}` : null,
            brand: marca || null,
          })
          logger.info(`✅ Producto encontrado (CANT-CODIGO-DESC): "${cleanDescription}" - Cant: ${qty}, Precio: ${unitPrice}, Total: ${totalPrice}, Código: ${codigo}, Marca: ${marca || 'N/A'}`)
          continue
        } else {
          logger.warn(`❌ Producto rechazado (CANT-CODIGO-DESC) - Desc: "${cleanDescription}", Precio: ${unitPrice}, Total: ${totalPrice}, isValidPrice: ${isValidPrice}`)
        }
      }
      
      // Buscar patrones de productos en formato de tabla (una sola línea)
      // Patrón 1: MARCA CODIGO DESCRIPCION CANT P.UNIT DTO TOTAL
      // Mejorado para manejar códigos alfanuméricos como "ROM 210" o "500-BU-00001"
      const tablePattern1 = /^([A-ZÁÉÍÓÚÑ]{2,15})\s+([A-Z0-9\s\-]{3,25})\s+([A-ZÁÉÍÓÚÑ\s\.\-]{5,80})\s+(\d{1,2})\s+(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)\s*(?:\d+%|\d+\.\d+%)?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)$/
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
        
        logger.info(`Patrón 1 parseado (tabla) - Marca: ${marca.trim()}, Código: ${codigo}, Desc: ${descripcion.trim()}, Cant: ${qty}, PrecioUnit: ${precioUnitStr} -> ${unitPrice}, Total: ${totalStr} -> ${totalPrice}`)
        
        // Validar que los precios sean razonables (reducir mínimo a 100)
        const isValidPrice = (unitPrice >= 100 && unitPrice < 10000000) || 
                            (unitPrice >= 50 && unitPrice < 100 && totalPrice >= 1000)
        
        if (isValidPrice && 
            totalPrice >= 100 && totalPrice < 10000000 &&
            descripcion.trim().length > 3 &&
            !descripcion.trim().match(/^\d+$/) &&
            !descripcion.trim().toLowerCase().includes('chiaia') &&
            !descripcion.trim().toLowerCase().includes('fabian')) {
          // Limpiar descripción: remover código si está al inicio
          let cleanDescription = descripcion.trim()
          if (codigo && cleanDescription.startsWith(codigo)) {
            cleanDescription = cleanDescription.substring(codigo.length).trim()
          }
          cleanDescription = cleanDescription.replace(/^DESCRIPCION\s+/i, '').trim()
          
          // El nombre es SOLO la descripción (sin marca ni código)
          result.items.push({
            item_name: cleanDescription,
            quantity: qty,
            unit_price: unitPrice,
            total_price: totalPrice > 0 ? totalPrice : (qty * unitPrice),
            description: codigo ? `Código: ${codigo}` : null,
            brand: marca ? marca.trim() : null, // Marca del producto
          })
          logger.info(`✅ Producto encontrado (patrón 1 tabla): ${marca.trim()} ${descripcion.trim()} - Cant: ${qty}, Precio: ${unitPrice}, Total: ${totalPrice}`)
          continue
        } else {
          logger.warn(`❌ Producto rechazado (patrón 1 tabla): ${descripcion.trim()} - Precio: ${unitPrice}, Total: ${totalPrice}, isValidPrice: ${isValidPrice}`)
        }
      }
      
      // Patrón 2: DESCRIPCION CANT PRECIO (sin marca/código al inicio)
      // Mejorado para capturar números con formato argentino (puntos para miles)
      const tablePattern2 = /^([A-ZÁÉÍÓÚÑ\s\.\-]{5,80})\s+(\d{1,2})\s+(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)\s+(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)$/
      const match2 = line.match(tablePattern2)
      
      if (match2) {
        const [, descripcion, cantidad, precioUnitStr, totalStr] = match2
        
        // Verificar que la descripción no sea solo números, fechas, o nombres de personas
        if (!/^\d+$/.test(descripcion.trim()) && 
            !/^\d{2}\/\d{2}\/\d{4}/.test(descripcion.trim()) &&
            !/^\d{2,4}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(descripcion.trim()) &&
            descripcion.trim().length > 5) {
          const parseArgentineNumber = (numStr) => {
            if (!numStr) return 0
            const cleaned = numStr.trim().replace(/\./g, '').replace(',', '.')
            return parseFloat(cleaned) || 0
          }
          
          const qty = parseFloat(cantidad) || 1
          const unitPrice = parseArgentineNumber(precioUnitStr)
          const totalPrice = parseArgentineNumber(totalStr)
          
          logger.info(`Patrón 2 parseado (tabla) - Desc: ${descripcion.trim()}, Cant: ${qty}, PrecioUnit: ${precioUnitStr} -> ${unitPrice}, Total: ${totalStr} -> ${totalPrice}`)
          
          // Validar que los precios sean razonables (reducir mínimo a 100)
          const isValidPrice = (unitPrice >= 100 && unitPrice < 10000000) || 
                              (unitPrice >= 50 && unitPrice < 100 && totalPrice >= 1000)
          
          if (isValidPrice && totalPrice >= 100 && totalPrice < 10000000) {
            result.items.push({
              item_name: descripcion.trim(),
              quantity: qty,
              unit_price: unitPrice,
              total_price: totalPrice || (qty * unitPrice),
              description: null,
              brand: null, // Sin marca en este patrón
            })
            logger.info(`✅ Producto encontrado (patrón 2 tabla): ${descripcion.trim()} - Cant: ${qty}, Precio: ${unitPrice}, Total: ${totalPrice}`)
            continue
          } else {
            logger.warn(`❌ Producto rechazado (patrón 2 tabla): ${descripcion.trim()} - Precio: ${unitPrice}, Total: ${totalPrice}, isValidPrice: ${isValidPrice}`)
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
              brand: null, // Sin marca en este patrón
            })
          }
        }
      }
    }
    
    // Si no encontramos productos con patrones de una línea, usar estrategia de agrupación
    if (result.items.length === 0) {
      logger.info('No se encontraron productos con patrones de una línea, usando agrupación de líneas')
      i = productTableStart
      
      while (i < productSectionEnd) {
        const line = lines[i]
        const lineLower = line.toLowerCase()
        
        // Excluir líneas que claramente NO son productos
        if (lineLower.includes('flete') ||
            lineLower.includes('forma de pago') ||
            lineLower.includes('metodo de pago') ||
            lineLower.includes('importe en letras') ||
            lineLower.includes('observaciones') ||
            lineLower.includes('estimado cliente') ||
            lineLower.includes('ud dispone') ||
            lineLower.includes('nro. caea') ||
            lineLower.includes('fecha de vto') ||
            lineLower === 'bonif' ||
            lineLower === 'dto' ||
            (lineLower === 'total' && !lineLower.includes('importe')) ||
            lineLower === '$' ||
            lineLower.includes('subtotal') ||
            lineLower.includes('iva')) {
          i++
          continue
        }
        
        // Buscar líneas con números grandes (precios)
        const largeNumberMatch = line.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)/)
        if (largeNumberMatch) {
          const priceValue = parseArgentineNumber(largeNumberMatch[1])
          
          // Filtrar precios razonables de productos (entre 100 y 200000)
          // Evitar totales de factura que son generalmente más grandes
          if (priceValue >= 100 && priceValue < 200000) {
            logger.info(`Línea ${i} contiene precio posible: ${largeNumberMatch[1]} -> ${priceValue}`)
            
            let cantidad = 1
            let codigo = null
            let marca = null
            let descripcion = null
            let precioUnitario = null
            let totalPrice = priceValue
            
            // Buscar cantidad
            for (let j = Math.max(i - 8, productTableStart); j < i; j++) {
              const qtyLine = lines[j].trim()
              if (/^\d{1,2}$/.test(qtyLine)) {
                const qty = parseInt(qtyLine)
                if (qty >= 1 && qty <= 100) {
                  cantidad = qty
                  logger.info(`Cantidad encontrada en línea ${j}: ${cantidad}`)
                  break
                }
              }
            }
            
            // Buscar precio unitario
            for (let j = Math.max(i - 5, productTableStart); j < i; j++) {
              const prevLine = lines[j].trim()
              const prevNumberMatch = prevLine.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)/)
              if (prevNumberMatch) {
                const prevPrice = parseArgentineNumber(prevNumberMatch[1])
                if (prevPrice >= 1000 && prevPrice <= totalPrice * 2 && prevPrice < 200000) {
                  precioUnitario = prevPrice
                  logger.info(`Precio unitario encontrado en línea ${j}: ${prevNumberMatch[1]} -> ${precioUnitario}`)
                  break
                }
              }
            }
            
            if (!precioUnitario) {
              precioUnitario = totalPrice / cantidad
              logger.info(`Precio unitario calculado: ${totalPrice} / ${cantidad} = ${precioUnitario}`)
            }
            
            // Buscar descripción
            for (let j = i - 1; j >= Math.max(i - 10, productTableStart); j--) {
              const prevLine = lines[j].trim()
              const prevLineLower = prevLine.toLowerCase()
              
              if (prevLine.length > 5 && 
                  prevLine.length < 120 &&
                  /[A-ZÁÉÍÓÚÑ]/.test(prevLine) &&
                  !prevLine.match(/^\d+$/) &&
                  !prevLine.match(/^\d{1,3}(?:\.\d{3})+(?:,\d{2})?$/) &&
                  !prevLine.match(/^\d+%$/) &&
                  !prevLineLower.includes('marca') &&
                  !prevLineLower.includes('codigo') &&
                  !prevLineLower.includes('articulo') &&
                  !prevLineLower.includes('cant') &&
                  !prevLineLower.includes('descripcion') &&
                  !prevLineLower.includes('precio') &&
                  !prevLineLower.includes('importe') &&
                  !prevLineLower.includes('total') &&
                  !prevLineLower.includes('subtotal') &&
                  !prevLineLower.includes('iva') &&
                  !prevLineLower.includes('dto') &&
                  !prevLineLower.includes('bonif') &&
                  !prevLineLower.includes('flete') &&
                  !prevLineLower.includes('cliente') &&
                  !prevLineLower.includes('vendedor')) {
                if (!descripcion || (prevLine.length > descripcion.length && prevLine.length > 10)) {
                  descripcion = prevLine
                  logger.info(`Descripción encontrada en línea ${j}: ${descripcion}`)
                }
              }
            }
            
            // Buscar código
            if (descripcion) {
              const descIndex = lines.findIndex((l, idx) => idx < i && l.trim() === descripcion)
              if (descIndex > 0) {
                for (let j = Math.max(descIndex - 3, productTableStart); j < descIndex; j++) {
                  const codeLine = lines[j].trim()
                  const codeLineLower = codeLine.toLowerCase()
                  
                  if (codeLineLower === 'cant' || codeLineLower === 'cant.' ||
                      codeLineLower === 'articulo' || codeLineLower === 'artículo' ||
                      codeLineLower === 'marca' || codeLineLower === 'codigo' ||
                      codeLineLower.includes('precio') || codeLineLower.includes('importe')) {
                    continue
                  }
                  
                  if ((/^\d{3,}$/.test(codeLine) || /^[A-Z0-9\s\-]{3,20}$/.test(codeLine)) &&
                      codeLine.length < 25 &&
                      !codeLineLower.includes('marca') &&
                      !codeLineLower.includes('codigo')) {
                    codigo = codeLine
                    logger.info(`Código encontrado en línea ${j}: ${codigo}`)
                    break
                  }
                }
              }
            }
            
            // Buscar marca (texto corto en mayúsculas antes del código)
            if (codigo) {
              const codeIndex = lines.findIndex((l, idx) => idx < i && l.trim() === codigo)
              if (codeIndex > 0) {
                for (let j = Math.max(codeIndex - 3, productTableStart); j < codeIndex; j++) {
                  const marcaLine = lines[j].trim()
                  // Buscar marca: texto corto en mayúsculas
                  if (/^[A-ZÁÉÍÓÚÑ]{2,15}$/.test(marcaLine) &&
                      !marcaLine.toLowerCase().includes('marca') &&
                      !marcaLine.toLowerCase().includes('codigo')) {
                    marca = marcaLine
                    logger.info(`Marca encontrada en línea ${j}: ${marca}`)
                    break
                  }
                }
              }
            }
            
            // Crear producto si tenemos descripción
            if (descripcion && totalPrice >= 1000) {
              // Limpiar la descripción: remover código si está incluido al inicio
              let cleanDescription = descripcion.trim()
              
              // Si la descripción empieza con el código, removerlo
              if (codigo && cleanDescription.startsWith(codigo)) {
                cleanDescription = cleanDescription.substring(codigo.length).trim()
              }
              
              // Remover palabras como "DESCRIPCION" si aparecen al inicio
              cleanDescription = cleanDescription.replace(/^DESCRIPCION\s+/i, '').trim()
              
              // El nombre del producto es SOLO la descripción limpia (sin código ni marca)
              const productName = cleanDescription
              
              const productNameLower = productName.toLowerCase()
              if (productNameLower.includes('flete') ||
                  productNameLower.includes('forma de pago') ||
                  productNameLower.includes('metodo de pago') ||
                  productNameLower.includes('importe en letras') ||
                  productNameLower.includes('observaciones') ||
                  productNameLower.includes('bonif') ||
                  productNameLower === 'dto' ||
                  productNameLower.includes('subtotal') ||
                  productNameLower.includes('iva') ||
                  (productNameLower.includes('total') && !productNameLower.includes('importe'))) {
                logger.warn(`❌ Producto excluido: "${productName}"`)
                i++
                continue
              }
              
              const productKey = codigo ? `${productNameLower}_${codigo}` : productNameLower
              
              if (!processedProducts.has(productKey)) {
                const finalUnitPrice = precioUnitario || (totalPrice / (cantidad || 1))
                
                result.items.push({
                  item_name: productName,
                  quantity: cantidad || 1,
                  unit_price: finalUnitPrice,
                  total_price: totalPrice,
                  description: codigo ? `Código: ${codigo}` : null,
                  brand: marca || null, // Marca del producto
                })
                processedProducts.add(productKey)
                logger.info(`✅ Producto encontrado (agrupación): "${productName}" - Cant: ${cantidad || 1}, Precio Unit: ${finalUnitPrice}, Total: ${totalPrice}, Código: ${codigo || 'N/A'}, Marca: ${marca || 'N/A'}`)
                
                i += 3
                continue
              }
            }
          }
        }
        
        i++
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
    
    // Eliminar items que contengan nombres de personas o códigos que no son productos
    if (nameLower.includes('chiaia') || 
        nameLower.includes('fabian') ||
        /^\d{2,4}\s+[a-záéíóúñ]/.test(item.item_name) ||
        /^-\w+-\d+/.test(item.item_name)) {
      return false
    }
    
    // Validación de precios más flexible:
    // - Precio unitario debe ser >= 50 (permite productos baratos)
    // - Precio total debe ser >= 100 (evita capturar códigos)
    // - Si el precio unitario es bajo pero el total es alto, es válido
    const isValidPrice = (item.unit_price >= 50 && item.unit_price < 10000000) || 
                         (item.unit_price >= 10 && item.unit_price < 50 && item.total_price >= 1000)
    const isValidTotal = item.total_price >= 100 && item.total_price < 10000000
    
    if (!isValidPrice || !isValidTotal) {
      logger.warn(`Item filtrado por precio inválido: ${item.item_name} - Precio: ${item.unit_price}, Total: ${item.total_price}`)
      return false
    }
    
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
