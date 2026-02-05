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
      
      logger.info(`Credenciales válidas para: ${credentials.client_email}`)
      
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
      logger.warn('No se encontró texto en la imagen')
      return res.status(400).json({
        error: 'No se pudo extraer texto de la imagen. Asegúrate de que sea una factura clara y legible.',
      })
    }

    const extractedText = fullTextAnnotation.text

    // Parsear el texto extraído para encontrar datos de la factura
    const parsedData = parseInvoiceText(extractedText)

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

  // 1. Buscar nombre del proveedor (generalmente en las primeras líneas)
  // Buscar patrones comunes: "RAZÓN SOCIAL", "PROVEEDOR", o simplemente texto en mayúsculas al inicio
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i]
    // Si la línea tiene más de 5 caracteres y no parece ser un número o fecha
    if (
      line.length > 5 &&
      !/^\d+/.test(line) &&
      !/^\d{2}\/\d{2}\/\d{4}/.test(line) &&
      !line.toLowerCase().includes('factura') &&
      !line.toLowerCase().includes('cuit') &&
      !line.toLowerCase().includes('fecha')
    ) {
      // Podría ser el nombre del proveedor
      if (!result.vendorName || line.length > result.vendorName.length) {
        result.vendorName = line
      }
    }
  }

  // 2. Buscar número de factura
  // Patrones: "FACTURA N°", "NRO", "Número", "001-12345678", etc.
  const invoiceNumberPatterns = [
    /(?:factura|fact|nro|número|numero)[\s:]*[°#]?[\s:]*(\d{1,4}[\s-]?\d{4,8})/i,
    /(\d{1,4}[\s-]\d{4,8})/, // Formato común: 001-12345678
    /(?:comprobante|comp)[\s:]*[°#]?[\s:]*(\d+)/i,
  ]

  for (const pattern of invoiceNumberPatterns) {
    const match = normalizedText.match(pattern)
    if (match) {
      result.invoiceNumber = match[1].replace(/\s/g, '')
      break
    }
  }

  // 3. Buscar fechas
  // Patrones: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
  const datePatterns = [
    /(\d{2}\/\d{2}\/\d{4})/g, // DD/MM/YYYY
    /(\d{4}-\d{2}-\d{2})/g, // YYYY-MM-DD
    /(\d{2}-\d{2}-\d{4})/g, // DD-MM-YYYY
  ]

  const dates = []
  for (const pattern of datePatterns) {
    const matches = normalizedText.match(pattern)
    if (matches) {
      dates.push(...matches)
    }
  }

  // Parsear fechas encontradas
  if (dates.length > 0) {
    // La primera fecha suele ser la fecha de emisión
    result.invoiceDate = parseDate(dates[0])
    // La segunda fecha (si existe) puede ser la de vencimiento
    if (dates.length > 1) {
      result.dueDate = parseDate(dates[1])
    }
  }

  // 4. Buscar importe total
  // Patrones: "TOTAL", "TOTAL A PAGAR", "$", "ARS", números grandes con decimales
  const totalPatterns = [
    /(?:total|total\s+a\s+pagar|importe\s+total)[\s:]*\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,
    /\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/, // $50.000,00
    /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:ars|pesos)/i,
  ]

  for (const pattern of totalPatterns) {
    const match = normalizedText.match(pattern)
    if (match) {
      const amountStr = match[1].replace(/\./g, '').replace(',', '.')
      result.totalAmount = parseFloat(amountStr) || 0
      break
    }
  }

  // Si no se encontró con patrones, buscar el número más grande que parezca un importe
  if (result.totalAmount === 0) {
    const largeNumbers = normalizedText.match(/\d{3,}(?:[.,]\d{2})?/g)
    if (largeNumbers) {
      const amounts = largeNumbers
        .map((num) => parseFloat(num.replace(/\./g, '').replace(',', '.')))
        .filter((num) => num > 100) // Filtrar números muy pequeños
        .sort((a, b) => b - a) // Ordenar de mayor a menor

      if (amounts.length > 0) {
        result.totalAmount = amounts[0] // El más grande probablemente es el total
      }
    }
  }

  // 5. Buscar productos/items
  // Esto es más complejo, buscamos líneas que parezcan productos
  // Patrones: número + descripción + cantidad + precio
  const itemLines = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Buscar líneas que tengan números (cantidad/precio) y texto (descripción)
    // Evitar líneas que son claramente encabezados o totales
    if (
      line.length > 10 &&
      /\d/.test(line) &&
      !line.toLowerCase().includes('total') &&
      !line.toLowerCase().includes('subtotal') &&
      !line.toLowerCase().includes('iva') &&
      !line.toLowerCase().includes('factura') &&
      !/^\d{2}\/\d{2}\/\d{4}/.test(line) // No fechas
    ) {
      itemLines.push(line)
    }
  }

  // Intentar parsear items de las líneas encontradas
  for (const line of itemLines.slice(0, 50)) {
    // Buscar patrones como: "CANTIDAD DESCRIPCIÓN PRECIO" o "DESCRIPCIÓN x CANTIDAD $PRECIO"
    const itemMatch = line.match(/(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:x|×)?\s*\$?\s*(\d+(?:[.,]\d+)?)/i)
    if (itemMatch) {
      const [, description, quantity, price] = itemMatch
      const qty = parseFloat(quantity.replace(',', '.')) || 1
      const unitPrice = parseFloat(price.replace(/\./g, '').replace(',', '.')) || 0

      if (description.trim().length > 2 && unitPrice > 0) {
        result.items.push({
          item_name: description.trim(),
          quantity: qty,
          unit_price: unitPrice,
          total_price: qty * unitPrice,
          description: null,
        })
      }
    } else {
      // Si no coincide con el patrón, intentar extraer solo descripción y precio
      const simpleMatch = line.match(/(.+?)\s+\$?\s*(\d+(?:\.\d{3})*(?:,\d{2})?)/)
      if (simpleMatch) {
        const [, description, price] = simpleMatch
        const unitPrice = parseFloat(price.replace(/\./g, '').replace(',', '.')) || 0

        if (description.trim().length > 2 && unitPrice > 0 && unitPrice < result.totalAmount) {
          result.items.push({
            item_name: description.trim(),
            quantity: 1,
            unit_price: unitPrice,
            total_price: unitPrice,
            description: null,
          })
        }
      }
    }
  }

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
