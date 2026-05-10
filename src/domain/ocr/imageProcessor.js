import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createWorker } from 'tesseract.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

/** @param {string | HTMLCanvasElement} imageSource */
async function preprocessImageSource(imageSource) {
  if (typeof HTMLCanvasElement !== 'undefined' && imageSource instanceof HTMLCanvasElement) {
    const outputCanvas = document.createElement('canvas')
    const context = outputCanvas.getContext('2d')
    outputCanvas.width = imageSource.width
    outputCanvas.height = imageSource.height
    context.drawImage(imageSource, 0, 0)
    const imageData = context.getImageData(0, 0, outputCanvas.width, outputCanvas.height)
    const { data } = imageData

    for (let index = 0; index < data.length; index += 4) {
      const grayscale = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114
      const threshold = grayscale > 210 ? 255 : grayscale < 170 ? 0 : grayscale
      data[index] = threshold; data[index + 1] = threshold; data[index + 2] = threshold
    }

    context.putImageData(imageData, 0, 0)
    return outputCanvas
  }

  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Nao foi possivel carregar a imagem para OCR.'))
    img.src = imageSource
  })

  const scale = 2
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  canvas.width = image.width * scale
  canvas.height = image.height * scale
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
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

/**
 * @param {string | HTMLCanvasElement} imageSource
 * @param {((message: string) => void) | undefined} onStatus
 */
export async function recognizeTextFromImageSource(imageSource, onStatus) {
  onStatus?.('Analisando imagem com OCR...')
  const worker = await createWorker('por+eng')

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
    })
    const result = await worker.recognize(imageSource)
    return result.data?.text || ''
  } finally {
    await worker.terminate()
  }
}

/**
 * @param {File} file
 * @param {((message: string) => void) | undefined} onStatus
 */
export async function extractTextFromImageFile(file, onStatus) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const processedCanvas = await preprocessImageSource(objectUrl)
    return await recognizeTextFromImageSource(processedCanvas, onStatus)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
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

/**
 * @param {File} file
 * @param {((message: string) => void) | undefined} onStatus
 */
export async function extractTextFromPdfFile(file, onStatus) {
  onStatus?.('Lendo texto do PDF...')
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pageTexts = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onStatus?.(`Lendo PDF: pagina ${pageNumber} de ${pdf.numPages}...`)
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    pageTexts.push(buildPdfPageText(textContent.items || []))
  }

  const extractedText = pageTexts.join('\n').trim()

  if (extractedText.replace(/\s/g, '').length >= 40) return extractedText

  onStatus?.('PDF sem texto legivel. Fazendo OCR das paginas...')
  const ocrTexts = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: context, viewport }).promise
    ocrTexts.push(await recognizeTextFromImageSource(canvas, onStatus))
  }

  return ocrTexts.join('\n')
}
