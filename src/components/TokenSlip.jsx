import { formatDateTime } from '@/lib/utils'
import { tokenQrToDataUrl } from '@/lib/tokenQr'
import { serviceService } from '@/services/service.service'

/** Mask a phone the same way the BE does for display: 98***43***. */
function maskPhone(phone) {
  if (!phone) return ''
  const p = String(phone).replace(/\s+/g, '')
  if (p.length < 10) return p
  return `${p.substring(0, 2)}***${p.substring(5, 7)}***`
}

/**
 * Build a map of package_id → service names[] from the packages API response.
 */
function buildPackageServicesMap(packages) {
  const map = {}
  for (const pkg of packages) {
    const names = []
    for (const s of pkg.services || []) {
      names.push(s.service_name)
    }
    for (const g of pkg.service_groups || []) {
      for (const s of g.services || []) {
        names.push(s.service_name)
        if (s.bonus_services) {
          for (const bs of s.bonus_services) {
            names.push(bs.service_name)
          }
        }
      }
    }
    map[pkg.package_id] = names
  }
  return map
}

function buildTokenSlipHTML(token, qrDataUrl = null, packagesMap = {}) {
  const items = token.services_requested || []
  const branchName = token.branch?.name || ''
  const issuedAt = token.created_at ? formatDateTime(token.created_at) : ''
  const maskedPhone = maskPhone(token.customer_phone_snap)
  const customerLine = `${token.customer_name_snap || ''}${maskedPhone ? ` · ${maskedPhone}` : ''}`

  // Support both legacy ({service_name}) and new ({kind, name}) shapes.
  const itemLabel = (it) => {
    const name = it.name || it.service_name || ''
    return it.kind === 'package' ? `[Pkg] ${name}` : name
  }
  const renderItem = (it) => {
    let html = `<div>• ${itemLabel(it)}</div>`
    if (it.kind === 'package' && it.package_id && packagesMap[it.package_id]) {
      for (const sn of packagesMap[it.package_id]) {
        html += `<div class="pkg-svc">&nbsp;&nbsp;&nbsp;&nbsp;${sn}</div>`
      }
    }
    return html
  }
  const servicesHtml = items.length
    ? `<div class="services">${items.map(renderItem).join('')}</div>`
    : ''

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Token ${token.token_number}</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 13px;
            font-weight: 700;
            color: #000;
            margin: 0;
            padding: 8px 6px;
            width: 74mm;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .center { text-align: center; }
          .branch { font-size: 13px; font-weight: 700; }
          .number {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 1px;
            margin: 6px 0 2px;
          }
          .not-for-payment {
            font-size: 13px;
            font-weight: 800;
            margin: 0 0 4px;
            text-transform: uppercase;
          }
          .customer { font-size: 13px; font-weight: 700; margin: 4px 0 2px; }
          .meta { font-size: 13px; font-weight: 700; color: #000; }
          .services {
            margin-top: 8px;
            border-top: 1px dashed #000;
            padding-top: 6px;
            text-align: left;
            font-size: 13px;
            font-weight: 700;
          }
          .pkg-svc {
            font-size: 13px;
            font-weight: 700;
            color: #000;
          }
          .footer {
            margin-top: 10px;
            font-size: 13px;
            font-weight: 700;
            border-top: 1px dashed #000;
            padding-top: 4px;
          }
          .testing {
            margin-top: 8px;
            padding: 6px 4px;
            border: 1px dashed #000;
            background: transparent;
            color: #000;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.35;
            text-align: center;
          }
          .qr {
            margin: 8px auto 4px;
            width: 72px;
            height: 72px;
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="center branch">${branchName}</div>
        <div class="center number">${token.token_number}</div>
        <div class="center not-for-payment">Not for payment</div>
        ${qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="Token QR" />` : ''}
        <div class="center customer">${customerLine}</div>
        <div class="center meta">${issuedAt}</div>
        ${servicesHtml}
        <div class="testing">
          <strong>Testing mode</strong><br />
          Tokens are new — you may hit issues loading services or packages at billing.
          Sorry for the inconvenience; please ask staff for help if anything looks wrong.
        </div>
        <div class="center footer">Show this token at billing</div>
      </body>
    </html>
  `
}

export async function printTokenSlip(token) {
  const qrDataUrl = await tokenQrToDataUrl(token).catch(() => null)

  // Fetch packages to resolve sub-services under package items
  const pkgIds = (token.services_requested || [])
    .filter((it) => it.kind === 'package' && it.package_id)
    .map((it) => it.package_id)
  let packagesMap = {}
  if (pkgIds.length > 0) {
    const res = await serviceService.getPackages({ is_active: 'true' }).catch(() => null)
    if (res?.data) {
      packagesMap = buildPackageServicesMap(res.data)
    }
  }

  const html = buildTokenSlipHTML(token, qrDataUrl, packagesMap)
  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => {
    w.print()
    w.close()
  }, 300)
}

export default printTokenSlip
