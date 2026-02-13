import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export default function BarcodeLabelSheet({ items, onClose }) {
  const barcodeRefs = useRef({})
  const printWindowRef = useRef(null)

  useEffect(() => {
    // Generar códigos de barras para todos los items
    items.forEach((item, index) => {
      const refKey = `barcode-${index}`
      if (barcodeRefs.current[refKey] && item.barcode) {
        try {
          JsBarcode(barcodeRefs.current[refKey], item.barcode, {
            format: 'CODE128',
            width: 2,
            height: 60,
            displayValue: true,
            fontSize: 14,
            margin: 5,
          })
        } catch (error) {
          console.error(`Error al generar código de barras para ${item.item_name}:`, error)
        }
      }
    })
  }, [items])

  const handlePrint = () => {
    // Calcular cuántas etiquetas caben en una hoja A4
    // Tamaño de etiqueta: 3.5in x 1.125in
    // Hoja A4: 8.27in x 11.69in
    // En horizontal: 2 etiquetas (3.5in * 2 = 7in, con márgenes)
    // En vertical: 10 etiquetas (1.125in * 10 = 11.25in, con márgenes)
    // Total: 2 columnas x 10 filas = 20 etiquetas por hoja
    
    const labelsPerRow = 2
    const rowsPerPage = 10
    const labelsPerPage = labelsPerRow * rowsPerPage
    
    // Generar HTML para todas las etiquetas
    const labelsHTML = items.map((item, index) => {
      const refKey = `barcode-print-${index}`
      return `
        <div class="label-item">
          <div class="label-header">ETIQUETA DE PRODUCTO</div>
          <div class="label-product">${(item.item_name || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}</div>
          ${item.code ? `<div class="label-code">Código: ${(item.code || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}</div>` : ''}
          ${item.brand ? `<div class="label-code">Marca: ${(item.brand || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}</div>` : ''}
          <div class="barcode-container">
            <svg id="${refKey}"></svg>
          </div>
          <div class="label-footer">${item.barcode || ''}</div>
        </div>
      `
    }).join('')

    // Generar scripts para cada código de barras
    const barcodeScripts = items.map((item, index) => {
      const refKey = `barcode-print-${index}`
      return `
        (function() {
          const barcodeEl = document.getElementById('${refKey}');
          const barcodeValue = '${item.barcode}';
          
          if (typeof JsBarcode !== 'undefined' && barcodeValue) {
            try {
              JsBarcode(barcodeEl, barcodeValue, {
                format: 'CODE128',
                width: 2,
                height: 60,
                displayValue: true,
                fontSize: 14,
                margin: 5,
              });
            } catch (err) {
              console.error('Error al generar código de barras:', err);
            }
          }
        })();
      `
    }).join('\n')

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas - ${items.length} productos</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @page {
              size: A4;
              margin: 0.5in;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              width: 100%;
              padding: 0;
            }
            .labels-container {
              display: grid;
              grid-template-columns: repeat(${labelsPerRow}, 1fr);
              gap: 0.2in;
              width: 100%;
              padding: 0.1in;
            }
            .label-item {
              width: 3.5in;
              height: 1.125in;
              padding: 8px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              border: 1px solid #000;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .label-header {
              font-size: 10px;
              font-weight: bold;
              margin-bottom: 4px;
              text-align: center;
            }
            .label-product {
              font-size: 9px;
              text-align: center;
              margin-bottom: 4px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .label-code {
              font-size: 8px;
              text-align: center;
              color: #666;
              margin-bottom: 4px;
            }
            .barcode-container {
              display: flex;
              justify-content: center;
              align-items: center;
              flex: 1;
              overflow: hidden;
              max-height: 40px;
            }
            svg {
              max-width: 100%;
              max-height: 40px;
              height: auto;
            }
            .label-footer {
              font-size: 8px;
              text-align: center;
              margin-top: 4px;
              font-weight: bold;
            }
            @media print {
              .label-item {
                border: 1px solid #000;
              }
            }
          </style>
        </head>
        <body>
          <div class="labels-container">
            ${labelsHTML}
          </div>
          <script>
            ${barcodeScripts}
          </script>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('Por favor, permite las ventanas emergentes para imprimir')
      return
    }
    
    printWindow.document.write(printContent)
    printWindow.document.close()

    printWindowRef.current = printWindow

    // Esperar a que se cargue el contenido y los códigos de barras antes de imprimir
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        // Cerrar la ventana después de imprimir (opcional)
        setTimeout(() => {
          printWindow.close()
        }, 1000)
      }, 1500)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Vista Previa de Etiquetas ({items.length} productos)
        </h2>
        
        {/* Vista previa de las etiquetas */}
        <div className="border-2 border-gray-300 p-4 mb-4 bg-white">
          <div className="grid grid-cols-2 gap-4">
            {items.map((item, index) => {
              const refKey = `barcode-preview-${index}`
              return (
                <div 
                  key={item.id || index}
                  className="border-2 border-gray-300 p-3 bg-white overflow-hidden" 
                  style={{ width: '3.5in', height: '1.125in', minHeight: '108px', maxHeight: '108px' }}
                >
                  <div className="text-center text-xs font-bold mb-1">ETIQUETA DE PRODUCTO</div>
                  <div className="text-center text-xs mb-1 truncate">{item.item_name || ''}</div>
                  {item.code && <div className="text-center text-xs text-gray-600 mb-0.5">Código: {item.code}</div>}
                  {item.brand && <div className="text-center text-xs text-gray-600 mb-0.5">Marca: {item.brand}</div>}
                  <div className="flex justify-center items-center" style={{ height: '40px', overflow: 'hidden' }}>
                    <svg 
                      ref={(el) => {
                        if (el) {
                          barcodeRefs.current[refKey] = el
                        }
                      }} 
                      style={{ maxWidth: '100%', maxHeight: '40px' }}
                    ></svg>
                  </div>
                  <div className="text-center text-xs font-bold mt-0.5">{item.barcode || ''}</div>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Las etiquetas se imprimirán en formato A4 con 2 columnas por 10 filas (20 etiquetas por hoja).
            {items.length > 20 && ` Se generarán ${Math.ceil(items.length / 20)} hoja(s).`}
          </p>
        </div>

        {/* Botones */}
        <div className="flex space-x-3">
          <button
            onClick={handlePrint}
            className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium"
          >
            Imprimir {items.length} Etiqueta(s)
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
