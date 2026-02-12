import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export default function BarcodeLabel({ item, onClose }) {
  const barcodeRef = useRef(null)
  const printWindowRef = useRef(null)

  useEffect(() => {
    if (barcodeRef.current && item.barcode) {
      try {
        // Generar código de barras EAN-13
        JsBarcode(barcodeRef.current, item.barcode, {
          format: 'EAN13',
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 16,
          margin: 10,
        })
      } catch (error) {
        console.error('Error al generar código de barras:', error)
        // Si falla EAN-13 (porque el código no es válido), usar CODE128
        try {
          JsBarcode(barcodeRef.current, item.barcode, {
            format: 'CODE128',
            width: 2,
            height: 80,
            displayValue: true,
            fontSize: 16,
            margin: 10,
          })
        } catch (err) {
          console.error('Error al generar código de barras CODE128:', err)
        }
      }
    }
  }, [item.barcode])

  const handlePrint = () => {
    // Obtener el SVG del código de barras generado
    const barcodeSvg = barcodeRef.current ? barcodeRef.current.outerHTML : ''
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta - ${item.item_name}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @page {
              size: 3.5in 1.125in;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              width: 3.5in;
              height: 1.125in;
              padding: 8px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              border: 1px solid #000;
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
            }
            svg {
              max-width: 100%;
              height: auto;
            }
            .label-footer {
              font-size: 8px;
              text-align: center;
              margin-top: 4px;
              font-weight: bold;
            }
            @media print {
              body {
                border: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="label-header">ETIQUETA DE PRODUCTO</div>
          <div class="label-product">${(item.item_name || '').replace(/"/g, '&quot;')}</div>
          ${item.code ? `<div class="label-code">Código: ${(item.code || '').replace(/"/g, '&quot;')}</div>` : ''}
          ${item.brand ? `<div class="label-code">Marca: ${(item.brand || '').replace(/"/g, '&quot;')}</div>` : ''}
          <div class="barcode-container">
            <svg id="barcode-print"></svg>
          </div>
          <div class="label-footer">${item.barcode || ''}</div>
          <script>
            (function() {
              const barcodeEl = document.getElementById('barcode-print');
              const barcodeValue = '${item.barcode}';
              
              if (typeof JsBarcode !== 'undefined' && barcodeValue) {
                try {
                  JsBarcode(barcodeEl, barcodeValue, {
                    format: 'EAN13',
                    width: 2,
                    height: 80,
                    displayValue: true,
                    fontSize: 16,
                    margin: 10,
                  });
                } catch (e) {
                  // Si falla EAN-13, usar CODE128
                  try {
                    JsBarcode(barcodeEl, barcodeValue, {
                      format: 'CODE128',
                      width: 2,
                      height: 80,
                      displayValue: true,
                      fontSize: 16,
                      margin: 10,
                    });
                  } catch (err) {
                    console.error('Error al generar código de barras:', err);
                  }
                }
              }
            })();
          </script>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank', 'width=400,height=300')
    if (!printWindow) {
      alert('Por favor, permite las ventanas emergentes para imprimir')
      return
    }
    
    printWindow.document.write(printContent)
    printWindow.document.close()

    printWindowRef.current = printWindow

    // Esperar a que se cargue el contenido y el código de barras antes de imprimir
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        // Cerrar la ventana después de imprimir (opcional)
        setTimeout(() => {
          printWindow.close()
        }, 1000)
      }, 1000)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Vista Previa de Etiqueta</h2>
        
        {/* Vista previa de la etiqueta */}
        <div className="border-2 border-gray-300 p-4 mb-4 bg-white" style={{ width: '3.5in', height: '1.125in', minHeight: '108px' }}>
          <div className="text-center text-xs font-bold mb-1">ETIQUETA DE PRODUCTO</div>
          <div className="text-center text-xs mb-1 truncate">{item.item_name || ''}</div>
          {item.code && <div className="text-center text-xs text-gray-600 mb-1">Código: {item.code}</div>}
          {item.brand && <div className="text-center text-xs text-gray-600 mb-1">Marca: {item.brand}</div>}
          <div className="flex justify-center items-center flex-1">
            <svg ref={barcodeRef}></svg>
          </div>
          <div className="text-center text-xs font-bold mt-1">{item.barcode || ''}</div>
        </div>

        {/* Botones */}
        <div className="flex space-x-3">
          <button
            onClick={handlePrint}
            className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium"
          >
            Imprimir
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
