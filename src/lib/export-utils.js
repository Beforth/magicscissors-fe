/**
 * Export Utilities for generating CSV, Excel, and PDF reports
 */

/**
 * Export data to CSV file
 */
export function exportToCSV(data, filename, options = {}) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('No data to export')
    return
  }

  const { columns, headers } = options

  // Get column keys - use specified columns or all keys from first row
  const keys = columns || Object.keys(data[0])

  // Use custom headers or capitalize keys
  const headerRow = headers || keys.map(k =>
    k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  )

  // Build CSV content
  const csvContent = [
    headerRow.join(','),
    ...data.map(row =>
      keys.map(key => {
        let value = row[key]
        // Handle nested objects
        if (value && typeof value === 'object') {
          value = JSON.stringify(value)
        }
        // Escape quotes and wrap in quotes if contains comma or quote
        if (value !== null && value !== undefined) {
          value = String(value)
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = `"${value.replace(/"/g, '""')}"`
          }
        } else {
          value = ''
        }
        return value
      }).join(',')
    )
  ].join('\n')

  // Add BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })

  downloadBlob(blob, `${filename}_${getDateSuffix()}.csv`)
}

/**
 * Export data to Excel (XLSX) format
 * Uses a simple XML-based format that Excel can open
 */
export function exportToExcel(data, filename, options = {}) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('No data to export')
    return
  }

  const { sheetName = 'Sheet1', columns, headers, title } = options

  // Get column keys
  const keys = columns || Object.keys(data[0])

  // Use custom headers or capitalize keys
  const headerRow = headers || keys.map(k =>
    k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  )

  // Build Excel XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<?mso-application progid="Excel.Sheet"?>\n'
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n'
  xml += '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n'

  // Add styles
  xml += '<Styles>\n'
  xml += '<Style ss:ID="Header">\n'
  xml += '  <Font ss:Bold="1" ss:Size="11"/>\n'
  xml += '  <Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/>\n'
  xml += '</Style>\n'
  xml += '<Style ss:ID="Title">\n'
  xml += '  <Font ss:Bold="1" ss:Size="14"/>\n'
  xml += '</Style>\n'
  xml += '<Style ss:ID="Currency">\n'
  xml += '  <NumberFormat ss:Format="₹#,##0.00"/>\n'
  xml += '</Style>\n'
  xml += '</Styles>\n'

  // Start worksheet
  xml += `<Worksheet ss:Name="${escapeXml(sheetName)}">\n`
  xml += '<Table>\n'

  // Add title row if provided
  if (title) {
    xml += '<Row>\n'
    xml += `<Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml(title)}</Data></Cell>\n`
    xml += '</Row>\n'
    xml += '<Row></Row>\n' // Empty row after title
  }

  // Header row
  xml += '<Row>\n'
  headerRow.forEach(header => {
    xml += `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(header)}</Data></Cell>\n`
  })
  xml += '</Row>\n'

  // Data rows
  data.forEach(row => {
    xml += '<Row>\n'
    keys.forEach(key => {
      let value = row[key]
      let type = 'String'
      let style = ''

      if (value === null || value === undefined) {
        value = ''
      } else if (typeof value === 'number') {
        type = 'Number'
        // Detect currency values
        if (key.includes('amount') || key.includes('price') || key.includes('revenue') ||
            key.includes('total') || key.includes('spent') || key.includes('value')) {
          style = ' ss:StyleID="Currency"'
        }
      } else if (typeof value === 'boolean') {
        value = value ? 'Yes' : 'No'
      } else if (value instanceof Date) {
        value = value.toISOString().split('T')[0]
      } else if (typeof value === 'object') {
        value = JSON.stringify(value)
      } else {
        value = String(value)
      }

      xml += `<Cell${style}><Data ss:Type="${type}">${escapeXml(String(value))}</Data></Cell>\n`
    })
    xml += '</Row>\n'
  })

  xml += '</Table>\n'
  xml += '</Worksheet>\n'
  xml += '</Workbook>'

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
  downloadBlob(blob, `${filename}_${getDateSuffix()}.xls`)
}

/**
 * Export report data to a printable HTML page (for PDF printing)
 */
export function exportToPDF(data, filename, options = {}) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    console.warn('No data to export')
    return
  }

  const {
    title = 'Report',
    subtitle = '',
    columns,
    headers,
    summaryCards = [],
    dateGenerated = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
  } = options

  // Get column keys for table data
  const keys = columns || (Array.isArray(data) ? Object.keys(data[0]) : [])
  const headerRow = headers || keys.map(k =>
    k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  )

  // Build HTML
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      color: #1e293b;
      background: white;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #6366f1;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: #6366f1;
    }
    .header p {
      margin: 4px 0 0;
      color: #64748b;
      font-size: 14px;
    }
    .meta {
      text-align: right;
      font-size: 12px;
      color: #64748b;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .summary-card .label {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .summary-card .value {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      font-size: 12px;
    }
    th {
      background: #f1f5f9;
      text-align: left;
      padding: 12px 8px;
      border-bottom: 2px solid #e2e8f0;
      font-weight: 600;
      white-space: nowrap;
    }
    td {
      padding: 10px 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:nth-child(even) { background: #f8fafc; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 600; }
    .currency { font-family: monospace; }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
      @page { margin: 1cm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
    </div>
    <div class="meta">
      <div>Generated: ${dateGenerated}</div>
      <div>Salon ERP</div>
    </div>
  </div>
`

  // Summary cards
  if (summaryCards.length > 0) {
    html += '<div class="summary-cards">\n'
    summaryCards.forEach(card => {
      html += `
      <div class="summary-card">
        <div class="label">${escapeHtml(card.label)}</div>
        <div class="value">${escapeHtml(card.value)}</div>
      </div>\n`
    })
    html += '</div>\n'
  }

  // Data table
  if (Array.isArray(data) && data.length > 0) {
    html += '<table>\n<thead>\n<tr>\n'
    headerRow.forEach((header, i) => {
      const isNumeric = typeof data[0][keys[i]] === 'number'
      html += `<th${isNumeric ? ' class="text-right"' : ''}>${escapeHtml(header)}</th>\n`
    })
    html += '</tr>\n</thead>\n<tbody>\n'

    data.forEach(row => {
      html += '<tr>\n'
      keys.forEach(key => {
        let value = row[key]
        const isNumeric = typeof value === 'number'
        let classes = []

        if (value === null || value === undefined) {
          value = '-'
        } else if (isNumeric) {
          classes.push('text-right')
          // Format as currency if applicable
          if (key.includes('amount') || key.includes('price') || key.includes('revenue') ||
              key.includes('total') || key.includes('spent') || key.includes('value')) {
            value = formatCurrency(value)
            classes.push('currency')
          }
        } else if (typeof value === 'object') {
          value = JSON.stringify(value)
        }

        html += `<td${classes.length ? ` class="${classes.join(' ')}"` : ''}>${escapeHtml(String(value))}</td>\n`
      })
      html += '</tr>\n'
    })

    html += '</tbody>\n</table>\n'
  }

  html += `
  <div class="footer">
    This report was generated by Salon ERP. Total records: ${Array.isArray(data) ? data.length : 0}
  </div>
  <script>
    // Auto-print and close
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`

  // Open in new window for printing
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
  }
}

/**
 * Export multiple sheets to a single Excel file
 */
export function exportMultipleSheetsToExcel(sheets, filename) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<?mso-application progid="Excel.Sheet"?>\n'
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n'
  xml += '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n'

  // Add styles
  xml += '<Styles>\n'
  xml += '<Style ss:ID="Header">\n'
  xml += '  <Font ss:Bold="1" ss:Size="11"/>\n'
  xml += '  <Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/>\n'
  xml += '</Style>\n'
  xml += '<Style ss:ID="Currency">\n'
  xml += '  <NumberFormat ss:Format="₹#,##0.00"/>\n'
  xml += '</Style>\n'
  xml += '</Styles>\n'

  sheets.forEach(sheet => {
    const { name, data, columns, headers } = sheet
    if (!data || data.length === 0) return

    const keys = columns || Object.keys(data[0])
    const headerRow = headers || keys.map(k =>
      k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    )

    xml += `<Worksheet ss:Name="${escapeXml(name)}">\n`
    xml += '<Table>\n'

    // Header row
    xml += '<Row>\n'
    headerRow.forEach(header => {
      xml += `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(header)}</Data></Cell>\n`
    })
    xml += '</Row>\n'

    // Data rows
    data.forEach(row => {
      xml += '<Row>\n'
      keys.forEach(key => {
        let value = row[key]
        let type = 'String'

        if (value === null || value === undefined) {
          value = ''
        } else if (typeof value === 'number') {
          type = 'Number'
        } else if (typeof value === 'object') {
          value = JSON.stringify(value)
        }

        xml += `<Cell><Data ss:Type="${type}">${escapeXml(String(value))}</Data></Cell>\n`
      })
      xml += '</Row>\n'
    })

    xml += '</Table>\n'
    xml += '</Worksheet>\n'
  })

  xml += '</Workbook>'

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
  downloadBlob(blob, `${filename}_${getDateSuffix()}.xls`)
}

// Helper functions
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function getDateSuffix() {
  return new Date().toISOString().split('T')[0]
}

function escapeXml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}
