import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createWorker as createTesseractWorker } from 'tesseract.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

function postProgress(message) {
  self.postMessage({ type: 'progress', message })
}

/** @param {Array<{ str?: string, transform?: number[] }>} items */
function buildPdfPageText(items = []) {
  const lines = new Map()

  items.forEach((item) => {
    const value = String(item.str || '').trim()
    if (!value) return
    const y = Math.round(Number(item.transform?.[5] || 0))
    const x = Number(item.transform?.[4] || 0)
    const bucket = lines.get(y) || []
    bucket.push({ x, value })
    lines.set(y, bucket)
  })

  return [...lines.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, values]) => values.sort((a, b) => a.x - b.x).map((e) => e.value).join(' '))
    .join('\n')
}

async function recognizeText(imageSource) {
  postProgress('Analisando imagem com OCR...')
  const worker = await createTesseractWorker('por+eng')
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' })
    const result = await worker.recognize(imageSource)
    return result.data?.text || ''
  } finally {
    await worker.terminate()
  }
}

async function preprocessOffscreenCanvas(bitmap) {
  const scale = 2
  const canvas = new OffscreenCanvas(bitmap.width * scale, bitmap.height * scale)
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = imageData

  for (let index = 0; index < data.length; index += 4) {
    const grayscale = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114
    const threshold = grayscale > 220 ? 255 : grayscale < 165 ? 0 : grayscale
    data[index] = threshold; data[index + 1] = threshold; data[index + 2] = threshold
  }

  context.putImageData(imageData, 0, 0)
  return canvas
}

async function extractFromPdf(file) {
  postProgress('Lendo texto do PDF...')
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pageTexts = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    postProgress(`Lendo PDF: pagina ${pageNumber} de ${pdf.numPages}...`)
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    pageTexts.push(buildPdfPageText(textContent.items || []))
  }

  const extractedText = pageTexts.join('\n').trim()
  if (extractedText.replace(/\s/g, '').length >= 40) return extractedText

  postProgress('PDF sem texto legivel. Fazendo OCR das paginas...')
  const ocrTexts = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    postProgress(`OCR pagina ${pageNumber} de ${pdf.numPages}...`)
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = new OffscreenCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')
    await page.render({ canvasContext: context, viewport }).promise
    ocrTexts.push(await recognizeText(canvas))
  }

  return ocrTexts.join('\n')
}

async function extractFromImage(file) {
  const bitmap = await createImageBitmap(file)
  const canvas = await preprocessOffscreenCanvas(bitmap)
  return recognizeText(canvas)
}

self.onmessage = async (event) => {
  const { type, file } = event.data
  if (type !== 'extractText') return

  try {
    const isPdf = file.type === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf')
    const text = isPdf ? await extractFromPdf(file) : await extractFromImage(file)
    self.postMessage({ type: 'result', text })
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || 'Nao foi possivel processar o arquivo.' })
  }
}
