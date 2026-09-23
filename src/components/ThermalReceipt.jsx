import { formatCurrency, formatDateTimeStored } from '@/lib/utils'

function buildReceiptHTML(bill) {
  const items = bill.items || []
  const payments = bill.payments || []

  const formatAmt = (amt) => formatCurrency(amt)

  // Group package items together, show non-package items individually
  let packageGroups = {}
  let standaloneItems = []

  if (bill.package_summary?.length) {
    // New backend format: use package_summary for grouping
    const usedItemIds = new Set()
    bill.package_summary.forEach((pkg) => {
      const pkgItems = items.filter((i) => i.package_instance_id === pkg.package_instance_id)
      pkgItems.forEach((i) => usedItemIds.add(i.item_id))
      const total = pkgItems.reduce((s, i) => s + i.total_price, 0)
      const discount = pkgItems.reduce((s, i) => s + (i.discount_amount || 0), 0)
      packageGroups[pkg.package_instance_id] = { name: pkg.package_name, total, discount }
    })
    items.forEach((item) => {
      if (!usedItemIds.has(item.item_id)) {
        standaloneItems.push(item)
      }
    })
  } else {
    // Legacy fallback: group by matching notes
    items.forEach((item) => {
      if (item.notes && items.filter((i) => i.notes === item.notes).length > 1) {
        const pkgName = item.notes
        if (!packageGroups[pkgName]) {
          packageGroups[pkgName] = { name: pkgName, total: 0, discount: 0 }
        }
        packageGroups[pkgName].total += item.total_price
        packageGroups[pkgName].discount += item.discount_amount || 0
      } else {
        standaloneItems.push(item)
      }
    })
  }

  let itemRows = ''

  const itemStatusById = {}
  items.forEach((item) => {
    if (item.item_id) itemStatusById[item.item_id] = item.status
  })

  const rightLabel = (empName, status) => {
    if (empName) return empName
    if (status === 'pending') return 'Pending'
    return ''
  }

  // Build a map of package_instance_id -> services from package_summary for employee info
  const pkgServiceMap = {}
  if (bill.package_summary?.length) {
    bill.package_summary.forEach((pkg) => {
      pkgServiceMap[pkg.package_instance_id] = pkg.services || []
    })
  }

  // Render package groups with service-level employee names
  Object.entries(packageGroups).forEach(([pkgKey, pkg]) => {
    const services = pkgServiceMap[pkgKey] || []
    itemRows += `
      <div style="margin-bottom:4px;">
        <div style="font-size:13px;font-weight:700;">${pkg.name}</div>`
    if (services.length > 0) {
      services.forEach((svc) => {
        const empName = svc.employee_name || (svc.employees || []).map((e) => e.full_name).join(', ') || ''
        const label = rightLabel(empName, itemStatusById[svc.item_id] || svc.status)
        itemRows += `
        <table style="width:100%;border-collapse:collapse;font-size:13px;font-weight:700;margin:0;padding-left:8px;">
          <tr>
            <td style="text-align:left;vertical-align:top;padding:0 8px 0 8px;">${svc.service_name}</td>
            ${label ? `<td style="text-align:right;vertical-align:top;white-space:nowrap;padding:0;">${label}</td>` : ''}
          </tr>
        </table>`
      })
    }
    itemRows += `
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-top:2px;">
          <span>Package Total:</span>
          <span>${formatAmt(pkg.total)}</span>
        </div>`
    if (pkg.discount > 0) {
      itemRows += `
        <div style="font-size:13px;font-weight:700;color:#000;">
          Disc: -${formatAmt(pkg.discount)}
        </div>`
    }
    itemRows += `</div>`
  })

  // Render standalone items with employee name
  standaloneItems.forEach((item) => {
    const name = item.item_name || 'Item'
    const typeLabel = item.item_type === 'product' ? ' (Product)' : ''
    const empName = item.employee_name ||
      (item.employees || []).map((e) => e.full_name).join(', ') ||
      item.employee?.full_name ||
      ''
    const label = rightLabel(empName, item.status)
    const qty = item.quantity
    const unitPrice = item.unit_price
    const total = item.total_price
    const discount = item.discount_amount

    itemRows += `
      <div style="margin-bottom:4px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;font-weight:700;margin:0;">
          <tr>
            <td style="text-align:left;vertical-align:top;padding:0 8px 0 0;">${name}${typeLabel}</td>
            ${label ? `<td style="text-align:right;vertical-align:top;white-space:nowrap;padding:0;">${label}</td>` : ''}
          </tr>
        </table>
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;">
          <span>${qty} x ${formatAmt(unitPrice)}</span>
          <span>${formatAmt(total)}</span>
        </div>`

    if (discount > 0) {
      itemRows += `
        <div style="font-size:13px;font-weight:700;color:#000;">
          Disc: -${formatAmt(discount)}
        </div>`
    }

    itemRows += `</div>`
  })

  const paymentRows = payments
    .map(
      (p) => {
        let modeLabel = p.payment_mode.toUpperCase()
        if (p.payment_mode === 'upi' && p.upi_account_name) {
          modeLabel = `UPI (${p.upi_account_name})`
        }
        return `
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-bottom:2px;">
        <span>${modeLabel}</span>
        <span>${formatAmt(p.amount)}</span>
      </div>`
      }
    )
    .join('')

  // Collect unique employee names from all items
  const allEmployeeNames = new Set()
  items.forEach((item) => {
    if (item.employee_name) {
      item.employee_name.split(',').forEach((n) => {
        const trimmed = n.trim()
        if (trimmed) allEmployeeNames.add(trimmed)
      })
    }
  })
  if (bill.package_summary?.length) {
    bill.package_summary.forEach((pkg) => {
      (pkg.services || []).forEach((svc) => {
        if (svc.employee_name) {
          svc.employee_name.split(',').forEach((n) => {
            const trimmed = n.trim()
            if (trimmed) allEmployeeNames.add(trimmed)
          })
        }
        (svc.employees || []).forEach((e) => {
          if (e.full_name) allEmployeeNames.add(e.full_name)
        })
      })
    })
  }
  const employeeLine = allEmployeeNames.size > 0 ? [...allEmployeeNames].join(', ') : ''

  const branchName = bill.branch?.branch_name || ''
  const branchPhone = bill.branch?.phone || ''
  const branchAddress = bill.branch?.address || ''
  const billNumber = bill.bill_number || ''
  const bookNumber = bill.book_number || ''
  const billDate = bill.bill_date ? formatDateTimeStored(bill.bill_date) : ''
  const customerName = bill.customer?.customer_name || ''
  const customerPhone = bill.customer?.phone_masked || bill.customer?.phone || ''
  const cashierName = bill.created_by?.full_name || ''
  const notes = bill.notes || ''

  const separator = `<div style="border-top:1px dashed #000;margin:6px 0;"></div>`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt ${billNumber}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 1mm;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          font-weight: 700;
          width: 74mm;
          padding: 2mm;
          color: #000;
          line-height: 1.3;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .center { text-align: center; }
        .bold { font-weight: 800; }
        .right { text-align: right; }
        .row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 700;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 800;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="center bold" style="font-size:13px;margin-bottom:2px;">
        ${branchName}
      </div>
      ${branchAddress ? `<div class="center" style="font-size:13px;font-weight:700;margin-bottom:1px;">${branchAddress}</div>` : ''}
      ${branchPhone ? `<div class="center" style="font-size:13px;font-weight:700;">Ph: ${branchPhone}</div>` : ''}

      ${separator}

      <!-- Bill Info -->
      <div style="font-size:13px;font-weight:700;">
        <div>Bill #: ${billNumber}</div>
        ${bookNumber ? `<div>No.   : ${bookNumber}</div>` : ''}
        <div>Date  : ${billDate}</div>
        <div>Customer: ${customerName}</div>
        ${customerPhone ? `<div>Phone: ${customerPhone}</div>` : ''}
      </div>

      ${separator}

      <div class="center bold" style="font-size:13px;margin-bottom:4px;">ITEMS</div>

      ${separator}

      <!-- Items -->
      ${itemRows}

      ${separator}

      <!-- Totals -->
      <div style="margin-bottom:2px;">
        <div class="row">
          <span>Subtotal:</span>
          <span>${formatAmt(bill.subtotal)}</span>
        </div>
        ${bill.discount_amount > 0 ? `
        <div class="row">
          <span>Discount:</span>
          <span>-${formatAmt(bill.discount_amount)}</span>
        </div>` : ''}
        ${(bill.taxable_subtotal ?? 0) > 0 && bill.tax_amount > 0 ? `
        <div class="row">
          <span>Taxable:</span>
          <span>${formatAmt(bill.taxable_subtotal)}</span>
        </div>` : ''}
        ${bill.tax_amount > 0 ? `
        <div class="row">
          <span>GST:</span>
          <span>${formatAmt(bill.tax_amount)}</span>
        </div>` : ''}
      </div>
      <div style="border-top:1px solid #000;margin:3px 0;"></div>
      <div class="total-row">
        <span>TOTAL:</span>
        <span>${formatAmt(bill.total_amount)}</span>
      </div>
      <div style="border-top:1px solid #000;margin:3px 0;"></div>

      ${separator}

      <!-- Payments -->
      <div class="center bold" style="font-size:13px;margin-bottom:4px;">PAYMENT</div>
      ${separator}
      ${paymentRows}

      ${separator}

      ${notes ? `
      <div style="font-size:13px;font-weight:700;">
        Notes: ${notes}
      </div>
      ${separator}
      ` : ''}

      ${employeeLine ? `<div style="font-size:13px;font-weight:700;">Employee: ${employeeLine}</div>` : ''}
      ${cashierName ? `<div style="font-size:13px;font-weight:700;">Cashier: ${cashierName}</div>` : ''}

      <div class="center" style="margin-top:6px;font-size:13px;font-weight:700;">
        Thank you for your visit!
      </div>
      <div class="center" style="font-size:13px;font-weight:700;margin-top:1px;">
        See you again :)
      </div>
    </body>
    </html>
  `
}

export function printThermalReceipt(bill) {
  const html = buildReceiptHTML(bill)
  const printWindow = window.open('', '_blank')
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 300)
}
