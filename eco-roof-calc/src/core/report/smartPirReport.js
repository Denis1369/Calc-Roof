import { resolveContractorProfile } from '@/core/report/contractorProfiles'

const REPORT_STORAGE_KEY = 'eco-roof-smartpir-report-html'
const REPORT_PAYLOAD_STORAGE_KEY = 'eco-roof-smartpir-report-payload'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function round2(value) {
  return Math.round(toNumber(value) * 100) / 100
}

function escapeHtml(value) {
  return `${value ?? ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatNumber(value, digits = 2) {
  return toNumber(value, 0).toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

function formatQty(value) {
  const num = round2(value)
  if (Number.isInteger(num)) {
    return num.toLocaleString('ru-RU')
  }

  return num.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

function formatMoney(value) {
  return `${formatNumber(value, 2)} ₽`
}

function buildContractorRequisitesMarkup(contractor) {
  const lines = Array.isArray(contractor?.requisites) ? contractor.requisites : []
  return lines
    .filter(Boolean)
    .map((line) => `<div class="signature-detail">${escapeHtml(line)}</div>`)
    .join('')
}

function getItemTotal(item) {
  return round2(toNumber(item?.qty, 0) * toNumber(item?.price, 0))
}

function getSectionTotals(section) {
  const worksTotal = round2(
    (section?.works || []).reduce((sum, item) => sum + getItemTotal(item), 0)
  )

  const materialsTotal = round2(
    (section?.materials || []).reduce((sum, item) => sum + getItemTotal(item), 0)
  )

  return {
    worksTotal,
    materialsTotal,
    total: round2(worksTotal + materialsTotal)
  }
}

function getGlobalRoofParams(zones = []) {
  return zones.reduce(
    (acc, zone) => {
      acc.area += toNumber(zone?.roofParams?.area, 0)
      acc.perimeter += toNumber(zone?.roofParams?.perimeter, 0)
      acc.parapetDrains += toNumber(zone?.roofParams?.parapetDrains, 0)
      acc.innerDrains += toNumber(zone?.roofParams?.innerDrains, 0)
      acc.aerators += toNumber(zone?.roofParams?.aerators, 0)
      return acc
    },
    {
      area: 0,
      perimeter: 0,
      parapetDrains: 0,
      innerDrains: 0,
      aerators: 0
    }
  )
}

function hasContent(section) {
  return (section?.works || []).length > 0 || (section?.materials || []).length > 0
}

function buildSectionBlock(section, zoneName = '', showZoneLabel = false) {
  const works = section?.works || []
  const materials = section?.materials || []
  const totals = getSectionTotals(section)

  const worksRows = works.length
    ? works.map((item) => `
      <tr>
        <td class="text">${escapeHtml(item?.name || 'Работа')}</td>
        <td class="center">${escapeHtml(item?.unit || '')}</td>
        <td class="right">${formatQty(item?.qty)}</td>
        <td class="right">${formatMoney(item?.price)}</td>
        <td class="right strong">${formatMoney(getItemTotal(item))}</td>
      </tr>
    `).join('')
    : `
      <tr>
        <td class="text empty" colspan="5">Нет работ в этом разделе</td>
      </tr>
    `

  const materialsRows = materials.length
    ? materials.map((item) => `
      <tr>
        <td class="text">${escapeHtml(item?.name || 'Материал')}</td>
        <td class="center">${escapeHtml(item?.unit || '')}</td>
        <td class="right">${formatQty(item?.qty)}</td>
        <td class="right">${formatMoney(item?.price)}</td>
        <td class="right strong">${formatMoney(getItemTotal(item))}</td>
      </tr>
    `).join('')
    : `
      <tr>
        <td class="text empty" colspan="5">Нет материалов в этом разделе</td>
      </tr>
    `

  return `
    <section class="section-block">
      ${showZoneLabel ? `<div class="zone-label">Участок: ${escapeHtml(zoneName || 'Без названия')}</div>` : ''}
      <table class="estimate-table">
        <colgroup>
          <col style="width: 56%;" />
          <col style="width: 10%;" />
          <col style="width: 12%;" />
          <col style="width: 11%;" />
          <col style="width: 11%;" />
        </colgroup>

        <tr class="section-title-row">
          <td colspan="5">${escapeHtml(section?.title || 'Раздел')}</td>
        </tr>

        <tr class="table-head">
          <th>Наименование работ / материалов</th>
          <th>Ед.изм.</th>
          <th>Кол-во</th>
          <th>Цена за ед.</th>
          <th>Сумма</th>
        </tr>

        <tr class="group-title">
          <td colspan="5">Работы:</td>
        </tr>
        ${worksRows}
        <tr class="subtotal-row">
          <td colspan="4">Итого за работы:</td>
          <td class="right strong">${formatMoney(totals.worksTotal)}</td>
        </tr>

        <tr class="group-title">
          <td colspan="5">Материалы:</td>
        </tr>
        ${materialsRows}
        <tr class="subtotal-row">
          <td colspan="4">Итого за материалы:</td>
          <td class="right strong">${formatMoney(totals.materialsTotal)}</td>
        </tr>

        <tr class="section-total-row">
          <td colspan="4">ИТОГО по разделу:</td>
          <td class="right strong">${formatMoney(totals.total)}</td>
        </tr>
      </table>
    </section>
  `
}

function buildOverheadBlock(overheadExpenses = []) {
  const rows = (overheadExpenses || []).filter((item) => {
    return `${item?.name || ''}`.trim() || toNumber(item?.qty, 0) || toNumber(item?.price, 0)
  })

  const total = round2(rows.reduce((sum, item) => sum + toNumber(item?.qty, 0) * toNumber(item?.price, 0), 0))

  const markup = rows.length
    ? rows.map((item) => `
      <tr>
        <td class="text">${escapeHtml(item?.name || 'Накладные расходы')}</td>
        <td class="center">${escapeHtml(item?.unit || '')}</td>
        <td class="right">${formatQty(item?.qty)}</td>
        <td class="right">${formatMoney(item?.price)}</td>
        <td class="right strong">${formatMoney(toNumber(item?.qty, 0) * toNumber(item?.price, 0))}</td>
      </tr>
    `).join('')
    : `
      <tr>
        <td class="text empty" colspan="5">Накладные расходы не добавлены</td>
      </tr>
    `

  return {
    total,
    markup: `
      <section class="section-block">
        <table class="estimate-table">
          <colgroup>
            <col style="width: 56%;" />
            <col style="width: 10%;" />
            <col style="width: 12%;" />
            <col style="width: 11%;" />
            <col style="width: 11%;" />
          </colgroup>

          <tr class="section-title-row">
            <td colspan="5">Накладные, транспортные, организационные и утилизационные расходы</td>
          </tr>

          <tr class="table-head">
            <th>Наименование</th>
            <th>Ед.изм.</th>
            <th>Кол-во</th>
            <th>Цена за ед.</th>
            <th>Сумма</th>
          </tr>

          ${markup}

          <tr class="section-total-row">
            <td colspan="4">ИТОГО по накладным расходам:</td>
            <td class="right strong">${formatMoney(total)}</td>
          </tr>
        </table>
      </section>
    `
  }
}

export function buildSmartPirReportHtml(payload = {}) {
  const projectName = `${payload?.projectName || 'Новый проект'}`.trim() || 'Новый проект'
  const vatRate = toNumber(payload?.vatRate, 0)
  const estimateZones = Array.isArray(payload?.estimateZones) ? payload.estimateZones : []
  const overheadExpenses = Array.isArray(payload?.overheadExpenses) ? payload.overheadExpenses : []
  const contractor = resolveContractorProfile(payload?.contractorProfile)

  const visibleZones = estimateZones.filter((zone) => {
    return (zone?.sections || []).some(hasContent)
  })

  const roof = getGlobalRoofParams(estimateZones)
  const sectionsMarkup = visibleZones.length
    ? visibleZones.map((zone, zoneIndex) => {
        const zoneSections = (zone?.sections || []).filter(hasContent)
        const showZoneLabel = visibleZones.length > 1

        return zoneSections.map((section, sectionIndex) => {
          return buildSectionBlock(
            section,
            zone?.name || `Участок ${zoneIndex + 1}`,
            showZoneLabel && sectionIndex === 0
          )
        }).join('')
      }).join('')
    : `
      <section class="section-block">
        <table class="estimate-table">
          <tr class="section-title-row">
            <td>В смете пока нет разделов для формирования отчёта</td>
          </tr>
        </table>
      </section>
    `

  const worksTotal = round2(
    estimateZones.reduce((sum, zone) => {
      return sum + (zone?.sections || []).reduce((sectionSum, section) => {
        return sectionSum + getSectionTotals(section).worksTotal
      }, 0)
    }, 0)
  )

  const materialsTotal = round2(
    estimateZones.reduce((sum, zone) => {
      return sum + (zone?.sections || []).reduce((sectionSum, section) => {
        return sectionSum + getSectionTotals(section).materialsTotal
      }, 0)
    }, 0)
  )

  const overheadBlock = buildOverheadBlock(overheadExpenses)
  const subtotal = round2(worksTotal + materialsTotal + overheadBlock.total)
  const vatAmount = round2(subtotal * (vatRate / 100))
  const grandTotal = round2(subtotal + vatAmount)
  const contractorRequisitesMarkup = buildContractorRequisitesMarkup(contractor)

  const multiZoneSummary = estimateZones.length > 1
    ? `
      <div class="roof-zones">
        ${(estimateZones || []).map((zone, index) => `
          <div>• ${escapeHtml(zone?.name || `Участок ${index + 1}`)} — S: ${formatQty(zone?.roofParams?.area)} м², P: ${formatQty(zone?.roofParams?.perimeter)} м.п.</div>
        `).join('')}
      </div>
    `
    : ''

  return `
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(projectName)} — отчет</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            color: #111827;
            background: #eef2f7;
          }
          .document {
            width: 100%;
            max-width: 1100px;
            margin: 24px auto 40px;
            background: #ffffff;
            padding: 30px 34px 42px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          }
          .top-line {
            text-align: right;
            font-size: 13px;
            margin-bottom: 24px;
          }
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-bottom: 26px;
          }
          .signature-card {
            font-size: 14px;
            line-height: 1.45;
          }
          .signature-title {
            font-weight: 700;
            margin-bottom: 6px;
          }
          .signature-detail {
            margin-top: 3px;
            font-size: 11px;
            line-height: 1.35;
          }
          .doc-title {
            text-align: center;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          .doc-subtitle {
            text-align: center;
            margin: 6px 0 22px;
            font-size: 14px;
          }
          .meta-block {
            margin-bottom: 22px;
            font-size: 14px;
            line-height: 1.55;
          }
          .meta-line {
            margin-bottom: 8px;
          }
          .roof-zones {
            margin-top: 8px;
          }
          .section-block {
            margin-bottom: 16px;
          }
          .zone-label {
            font-size: 13px;
            font-weight: 700;
            margin: 12px 0 8px;
            color: #334155;
          }
          .estimate-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .estimate-table th,
          .estimate-table td {
            border: 1px solid #000000;
            padding: 8px 10px;
            font-size: 13px;
            vertical-align: middle;
          }
          .estimate-table .section-title-row td {
            font-size: 15px;
            font-weight: 700;
            background: #f5f7fb;
          }
          .estimate-table .table-head th {
            text-align: center;
            font-weight: 700;
            background: #eef2f7;
          }
          .estimate-table .group-title td {
            font-style: italic;
            font-weight: 700;
            background: #fafafa;
          }
          .estimate-table .subtotal-row td {
            background: #fcfcfd;
            font-weight: 700;
          }
          .estimate-table .section-total-row td {
            background: #f4f6fb;
            font-weight: 700;
            font-size: 14px;
          }
          .estimate-table .text {
            text-align: left;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .estimate-table .center {
            text-align: center;
          }
          .estimate-table .right {
            text-align: right;
            white-space: nowrap;
          }
          .estimate-table .strong {
            font-weight: 700;
            white-space: nowrap;
          }
          .estimate-table .empty {
            color: #64748b;
            text-align: center;
          }
          .totals-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 24px;
          }
          .totals-table td {
            border: 1px solid #000000;
            padding: 10px 12px;
            font-size: 14px;
          }
          .totals-table .label {
            font-weight: 700;
          }
          .totals-table .value {
            text-align: right;
            font-weight: 700;
            white-space: nowrap;
          }
          .totals-table .grand td {
            font-size: 18px;
            background: #f4f6fb;
          }
          .footer-note {
            margin-top: 26px;
            font-size: 12px;
            color: #475569;
          }
          @media print {
            body {
              background: #ffffff;
            }
            .document {
              box-shadow: none;
              margin: 0;
              max-width: none;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <main class="document">
          <div class="top-line">Приложение №1 к коммерческой смете объекта</div>

          <div class="signatures">
            <div class="signature-card">
              <div class="signature-title">«Подрядчик»</div>
              <div>${escapeHtml(contractor.name)}</div>
              <div>${escapeHtml(contractor.innKppLabel)}</div>
              ${contractorRequisitesMarkup}
              <div>${escapeHtml(contractor.signatureLabel)}</div>
            </div>

            <div class="signature-card">
              <div class="signature-title">«Заказчик»</div>
              <div>__________________________________</div>
              <div>ИНН / КПП: _______________________</div>
              <div>Директор _________________________</div>
            </div>
          </div>

          <h1 class="doc-title">СМЕТА</h1>
          <div class="doc-subtitle">по проекту: ${escapeHtml(projectName)}</div>

          <div class="meta-block">
            <div class="meta-line"><strong>Наименование объекта:</strong> ${escapeHtml(projectName)}</div>
            <div class="meta-line"><strong>Адрес объекта:</strong> ______________________________</div>
            <div class="meta-line">
              <strong>Данные крыши:</strong><br />
              Суммарная площадь кровли = ${formatNumber(roof.area, 2)} м²;<br />
              Примыкания к парапету и вертикальным конструкциям = ${formatNumber(roof.perimeter, 2)} пог.м;<br />
              Водоотведение: парапетное — ${formatQty(roof.parapetDrains)} шт.;<br />
              Водоотведение: внутреннее — ${formatQty(roof.innerDrains)} шт.;<br />
              Аэраторы — ${formatQty(roof.aerators)} шт.
              ${multiZoneSummary}
            </div>
          </div>

          ${sectionsMarkup}
          ${overheadBlock.markup}

          <table class="totals-table">
            <tr>
              <td class="label">ИТОГО по разделам материалы:</td>
              <td class="value">${formatMoney(materialsTotal)}</td>
            </tr>
            <tr>
              <td class="label">ИТОГО по разделам монтажные работы:</td>
              <td class="value">${formatMoney(worksTotal)}</td>
            </tr>
            <tr>
              <td class="label">ИТОГО по накладным расходам:</td>
              <td class="value">${formatMoney(overheadBlock.total)}</td>
            </tr>
            <tr>
              <td class="label">ИТОГО без НДС:</td>
              <td class="value">${formatMoney(subtotal)}</td>
            </tr>
            <tr>
              <td class="label">НДС (${formatQty(vatRate)}%):</td>
              <td class="value">${formatMoney(vatAmount)}</td>
            </tr>
            <tr class="grand">
              <td class="label">Итого общая сумма по всем разделам:</td>
              <td class="value">${formatMoney(grandTotal)}</td>
            </tr>
          </table>

          <div class="footer-note">
            Отчёт сформирован автоматически из текущей сметы. При необходимости отредактируй смету и снова нажми «Создать отчёт».
          </div>
        </main>
      </body>
    </html>
  `
}

export function saveSmartPirReportHtml(html = '') {
  const value = `${html || ''}`
  if (!value) return false
  sessionStorage.setItem(REPORT_STORAGE_KEY, value)
  return true
}

export function loadSmartPirReportHtml() {
  return sessionStorage.getItem(REPORT_STORAGE_KEY) || ''
}

export function saveSmartPirReportPayload(payload = {}) {
  try {
    sessionStorage.setItem(REPORT_PAYLOAD_STORAGE_KEY, JSON.stringify(payload || {}))
    return true
  } catch {
    return false
  }
}

export function loadSmartPirReportPayload() {
  try {
    const raw = sessionStorage.getItem(REPORT_PAYLOAD_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function createSmartPirReportSession(payload = {}) {
  const html = buildSmartPirReportHtml(payload)
  saveSmartPirReportHtml(html)
  saveSmartPirReportPayload(payload)
  return html
}

export { REPORT_STORAGE_KEY, REPORT_PAYLOAD_STORAGE_KEY }
