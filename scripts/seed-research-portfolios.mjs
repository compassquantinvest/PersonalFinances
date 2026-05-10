// Roda com: node scripts/seed-research-portfolios.mjs
// Atualiza as carteiras Suno FIIs, Suno Dividendos e Finclass FIIs
// preservando dados de outras fontes (XP, etc.)

import { loadResearchPortfolios, saveResearchPortfolios } from '../server/resources/researchPortfolios.mjs'

const sunoFiis = [
  { ticker: 'XPML11', company: 'Shopping (Tijolo)',     allocation: 5.0, dyExpected: 10.1, ceilingPrice: 129.00 },
  { ticker: 'PMLL11', company: 'Shopping (Tijolo)',     allocation: 5.0, dyExpected: 11.1, ceilingPrice: 126.00 },
  { ticker: 'TRXF11', company: 'Híbrido (Tijolo)',      allocation: 5.0, dyExpected: 12.7, ceilingPrice: 125.00 },
  { ticker: 'GARE11', company: 'Híbrido (Tijolo)',      allocation: 5.0, dyExpected: 12.0, ceilingPrice: 10.90  },
  { ticker: 'BTLG11', company: 'Logístico (Tijolo)',    allocation: 5.0, dyExpected:  9.3, ceilingPrice: 112.00 },
  { ticker: 'VISC11', company: 'Shopping (Tijolo)',     allocation: 5.0, dyExpected:  9.0, ceilingPrice: 118.00 },
  { ticker: 'RECR11', company: 'CRI (Papel)',           allocation: 5.0, dyExpected: 11.5, ceilingPrice:  89.00 },
  { ticker: 'HGRU11', company: 'Híbrido (Tijolo)',      allocation: 5.0, dyExpected:  9.1, ceilingPrice: 140.00 },
  { ticker: 'HGLG11', company: 'Logístico (Tijolo)',    allocation: 5.0, dyExpected:  8.8, ceilingPrice: 162.00 },
  { ticker: 'MXRF11', company: 'CRI (Papel)',           allocation: 5.0, dyExpected: 12.1, ceilingPrice:   9.90 },
  { ticker: 'KNUQ11', company: 'CRI (Papel)',           allocation: 5.0, dyExpected: 14.8, ceilingPrice: 106.00 },
  { ticker: 'VGIP11', company: 'CRI (Papel)',           allocation: 5.0, dyExpected: 11.7, ceilingPrice:  92.00 },
  { ticker: 'FATN11', company: 'Corporativo (Tijolo)',  allocation: 5.0, dyExpected: 11.1, ceilingPrice:  92.00 },
  { ticker: 'BRCO11', company: 'Logístico (Tijolo)',    allocation: 5.0, dyExpected:  9.3, ceilingPrice: 129.00 },
  { ticker: 'MCCI11', company: 'CRI (Papel)',           allocation: 5.0, dyExpected: 12.3, ceilingPrice:  96.00 },
  { ticker: 'XPLG11', company: 'Logístico (Tijolo)',    allocation: 5.0, dyExpected:  9.8, ceilingPrice: 115.00 },
  { ticker: 'KNRI11', company: 'Híbrido (Tijolo)',      allocation: 5.0, dyExpected:  7.9, ceilingPrice: 164.00 },
  { ticker: 'RBRY11', company: 'CRI (Papel)',           allocation: 5.0, dyExpected: 14.3, ceilingPrice:   null },
  { ticker: 'VRTA11', company: 'CRI (Papel)',           allocation: 5.0, dyExpected: 13.2, ceilingPrice:   null },
  { ticker: 'PVBI11', company: 'Corporativo (Tijolo)',  allocation: 5.0, dyExpected:  6.5, ceilingPrice:   null },
].map((p) => ({ ...p, id: `suno-fiis-${p.ticker}`, currentPrice: null }))

const sunoDividendos = [
  { ticker: 'WIZC3',  company: 'WIZ Co',           allocation: 10.0, dyExpected: 10.1, ceilingPrice: 10.00 },
  { ticker: 'BBSE3',  company: 'BB Seguridade',     allocation: 10.0, dyExpected: 11.4, ceilingPrice: 35.50 },
  { ticker: 'BBAS3',  company: 'Banco do Brasil',   allocation: 10.0, dyExpected:  4.9, ceilingPrice: 25.00 },
  { ticker: 'UNIP6',  company: 'Unipar',            allocation: 10.0, dyExpected:  9.7, ceilingPrice: 70.00 },
  { ticker: 'SEER3',  company: 'SER Educacional',   allocation:  5.0, dyExpected:  7.0, ceilingPrice: 14.00 },
  { ticker: 'SLCE3',  company: 'SLC Agrícola',      allocation:  5.0, dyExpected:  6.0, ceilingPrice: 20.40 },
  { ticker: 'VALE3',  company: 'Vale',              allocation:  5.0, dyExpected:  5.7, ceilingPrice: 78.00 },
  { ticker: 'PETR4',  company: 'Petrobras',         allocation:  7.5, dyExpected:  6.6, ceilingPrice: 38.00 },
  { ticker: 'AXIA6',  company: 'Axia',              allocation:  5.0, dyExpected:  6.7, ceilingPrice: 43.80 },
  { ticker: 'TUPY3',  company: 'Tupy',              allocation:  7.5, dyExpected:  1.6, ceilingPrice: 21.00 },
  { ticker: 'AGRO3',  company: 'BrasilAgro',        allocation:  2.5, dyExpected:  5.5, ceilingPrice: 27.50 },
  { ticker: 'EGIE3',  company: 'Engie Brasil',      allocation:  7.5, dyExpected:  7.1, ceilingPrice: 28.60 },
  { ticker: 'ITSA4',  company: 'Itaúsa',            allocation:  5.0, dyExpected:  6.4, ceilingPrice: 11.50 },
].map((p) => ({ ...p, id: `suno-dividendos-${p.ticker}`, currentPrice: null }))

const finclassFiis = [
  { ticker: 'PSEC11', company: 'Pátria Securities',                          allocation: 1.50, dyExpected: 13.23, ceilingPrice:  81.00 },
  { ticker: 'RBRX11', company: 'Patria Plus Multiestratégia Real Estate FII', allocation: 1.25, dyExpected: 12.51, ceilingPrice:   9.35 },
  { ticker: 'CPTS11', company: 'Capitânia Securities II',                    allocation: 2.25, dyExpected: 13.26, ceilingPrice:   8.90 },
  { ticker: 'TRXF11', company: 'TRX Real Estate',                            allocation: 1.50, dyExpected: 12.93, ceilingPrice: 101.00 },
  { ticker: 'VILG11', company: 'Vinci Logística',                            allocation: 1.25, dyExpected:  8.72, ceilingPrice: 111.00 },
  { ticker: 'LVBI11', company: 'VBI Logístico',                              allocation: 0.75, dyExpected:  8.21, ceilingPrice: 125.00 },
  { ticker: 'PVBI11', company: 'VBI Prime Properties',                       allocation: 1.00, dyExpected:  7.11, ceilingPrice: 110.00 },
  { ticker: 'BRCR11', company: 'BTG Corporate Office Fund FII',              allocation: 1.00, dyExpected: 10.64, ceilingPrice:  85.00 },
  { ticker: 'XPC11',  company: 'XP Crédito Imobiliário',                    allocation: 1.50, dyExpected: 13.12, ceilingPrice:  95.00 },
  { ticker: 'RBVA11', company: 'Rio Bravo Renda Varejo',                     allocation: 1.00, dyExpected: 11.11, ceilingPrice:  10.45 },
  { ticker: 'XPML11', company: 'XP Malls',                                   allocation: 1.00, dyExpected: 10.18, ceilingPrice: 115.00 },
  { ticker: 'VISC11', company: 'Vinci Shopping Centers FII',                 allocation: 1.00, dyExpected:  8.87, ceilingPrice: 136.00 },
].map((p) => ({ ...p, id: `finclass-fiis-${p.ticker}`, currentPrice: null }))

const existing = loadResearchPortfolios()

const updated = {
  ...existing,
  fiis: {
    ...(existing.fiis || {}),
    Suno: sunoFiis,
    Finclass: finclassFiis,
  },
  dividendos: {
    ...(existing.dividendos || {}),
    Suno: sunoDividendos,
  },
}

saveResearchPortfolios(updated)

console.log(`Suno FIIs:       ${sunoFiis.length} posições`)
console.log(`Suno Dividendos: ${sunoDividendos.length} posições`)
console.log(`Finclass FIIs:   ${finclassFiis.length} posições`)
console.log('Carteiras atualizadas com sucesso.')
