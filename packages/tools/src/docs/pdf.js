import fs from 'fs/promises'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import {
  clampNumber,
  normalizeHexColor,
  normalizeStructuredBlocks,
  resolvePathInputFromPayload,
  resolvePathWithExtension
} from './utils.js'
const parsePdfColor = (value, fallback = '000000') => {
  const hex = normalizeHexColor(value, fallback)
  const red = parseInt(hex.slice(0, 2), 16) / 255
  const green = parseInt(hex.slice(2, 4), 16) / 255
  const blue = parseInt(hex.slice(4, 6), 16) / 255
  return rgb(red, green, blue)
}
const wrapTextByWidth = (inputText, font, fontSize, maxWidth) => {
  const words = String(inputText || '')
    .replace(/\r/g, '')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return ['']
  const lines = []
  let currentLine = ''
  for (const word of words) {
    const candidateLine = currentLine ? `${currentLine} ${word}` : word
    const candidateWidth = font.widthOfTextAtSize(candidateLine, fontSize)
    if (candidateWidth <= maxWidth || !currentLine) {
      currentLine = candidateLine
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}
const normalizePdfTheme = (theme) => {
  const safeTheme = theme && typeof theme === 'object' ? theme : {}
  const headingDefaults = [18, 16, 14, 13]
  const providedHeadingSizes = Array.isArray(safeTheme.headingSizes) ? safeTheme.headingSizes : []
  return {
    backgroundColor: normalizeHexColor(safeTheme.backgroundColor, 'FFFFFF'),
    titleColor: normalizeHexColor(safeTheme.titleColor, '131313'),
    headingColor: normalizeHexColor(safeTheme.headingColor, '1E1E1E'),
    textColor: normalizeHexColor(safeTheme.textColor, '262626'),
    quoteColor: normalizeHexColor(safeTheme.quoteColor, '4B5563'),
    separatorColor: normalizeHexColor(safeTheme.separatorColor, 'D1D5DB'),
    titleSize: clampNumber(safeTheme.titleSize, 24, 12, 72),
    headingSizes: headingDefaults.map((fallback, index) =>
      clampNumber(providedHeadingSizes[index], fallback, 10, 40)
    ),
    bodySize: clampNumber(safeTheme.bodySize, 12, 8, 28),
    margin: clampNumber(safeTheme.margin, 50, 24, 96)
  }
}
const resolvePdfFont = (fonts, style) => {
  const wantsBold = Boolean(style?.bold)
  const wantsItalic = Boolean(style?.italic)
  if (wantsBold && wantsItalic) return fonts.boldItalic
  if (wantsBold) return fonts.bold
  if (wantsItalic) return fonts.italic
  return fonts.regular
}
export async function createPdfDocument(payload) {
  const safePayload = payload && typeof payload === 'object' ? payload : {}
  const pathInput = resolvePathInputFromPayload(safePayload)
  if (!pathInput) {
    throw new Error('Path is required. Provide path/filePath/targetPath, or directory + filename.')
  }
  const targetPath = resolvePathWithExtension(pathInput, '.pdf')
  const title = String(safePayload?.title || '').trim()
  const shouldCreateParents = safePayload?.createParents !== false
  const blocks = normalizeStructuredBlocks(safePayload)
  const theme = normalizePdfTheme(safePayload?.theme)
  if (shouldCreateParents) {
    const { dirname } = await import('path')
    await fs.mkdir(dirname(targetPath), {
      recursive: true
    })
  }
  const hasRenderableBlocks = blocks.some((block) => block.type !== 'separator')
  if (!title && !hasRenderableBlocks) {
    throw new Error(
      'No PDF content provided. Pass content/blocks (or body/text/markdown), or include a title.'
    )
  }
  const pdfDocument = await PDFDocument.create()
  const fonts = {
    regular: await pdfDocument.embedFont(StandardFonts.Helvetica),
    bold: await pdfDocument.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDocument.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdfDocument.embedFont(StandardFonts.HelveticaBoldOblique)
  }
  const pageWidth = 595
  const pageHeight = 842
  const margin = theme.margin
  const bodyMaxWidth = pageWidth - margin * 2
  const backgroundColor = parsePdfColor(theme.backgroundColor, 'FFFFFF')
  const defaultTextColor = parsePdfColor(theme.textColor, '262626')
  let page
  let cursorY = 0
  const addNewPage = () => {
    page = pdfDocument.addPage([pageWidth, pageHeight])
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: backgroundColor
    })
    cursorY = pageHeight - margin
  }
  const ensureSpace = (requiredHeight) => {
    if (cursorY - requiredHeight < margin) addNewPage()
  }
  const drawWrappedText = ({
    text,
    font,
    size,
    color,
    x,
    maxWidth,
    spacingBefore = 0,
    spacingAfter = 6,
    lineHeightMultiplier = 1.4
  }) => {
    const lineHeight = Math.max(size * lineHeightMultiplier, size + 2)
    const paragraphs = String(text || '').split(/\r?\n/)
    if (spacingBefore > 0) {
      ensureSpace(spacingBefore + lineHeight)
      cursorY -= spacingBefore
    }
    for (const paragraphText of paragraphs) {
      if (!paragraphText.trim()) {
        ensureSpace(lineHeight * 0.6)
        cursorY -= lineHeight * 0.6
        continue
      }
      const wrappedLines = wrapTextByWidth(paragraphText, font, size, maxWidth)
      for (const line of wrappedLines) {
        ensureSpace(lineHeight)
        page.drawText(line, {
          x,
          y: cursorY,
          size,
          font,
          color
        })
        cursorY -= lineHeight
      }
    }
    cursorY -= spacingAfter
  }
  addNewPage()
  if (title) {
    drawWrappedText({
      text: title,
      font: fonts.bold,
      size: theme.titleSize,
      color: parsePdfColor(theme.titleColor, '131313'),
      x: margin,
      maxWidth: bodyMaxWidth,
      spacingAfter: 12,
      lineHeightMultiplier: 1.25
    })
  }
  for (const block of blocks) {
    if (block.type === 'separator') {
      const spacingAfter = clampNumber(block.style.spacingAfter, 10, 0, 120)
      ensureSpace(14 + spacingAfter)
      const lineY = cursorY - 4
      page.drawLine({
        start: {
          x: margin,
          y: lineY
        },
        end: {
          x: pageWidth - margin,
          y: lineY
        },
        thickness: 1,
        color: parsePdfColor(theme.separatorColor, 'D1D5DB')
      })
      cursorY -= 12 + spacingAfter
      continue
    }
    const style = block.style || {}
    const indentPoints = Math.max(0, Math.round(clampNumber(style.indent, 0, 0, 2000) / 20))
    if (block.type === 'heading') {
      const size =
        style.size ||
        theme.headingSizes[Math.max(0, Math.min(block.level - 1, 3))] ||
        theme.bodySize
      drawWrappedText({
        text: block.text,
        font: resolvePdfFont(fonts, {
          ...style,
          bold: true
        }),
        size,
        color: parsePdfColor(style.color || theme.headingColor, theme.headingColor),
        x: margin + indentPoints,
        maxWidth: bodyMaxWidth - indentPoints,
        spacingBefore: clampNumber(style.spacingBefore, 8, 0, 120),
        spacingAfter: clampNumber(style.spacingAfter, 8, 0, 120),
        lineHeightMultiplier: 1.3
      })
      continue
    }
    if (block.type === 'quote') {
      const size = style.size || Math.max(theme.bodySize - 1, 8)
      const lineHeight = Math.max(size * 1.4, size + 2)
      const quoteLines = wrapTextByWidth(
        block.text,
        resolvePdfFont(fonts, {
          ...style,
          italic: true
        }),
        size,
        bodyMaxWidth - indentPoints - 12
      )
      const spacingBefore = clampNumber(style.spacingBefore, 4, 0, 120)
      const spacingAfter = clampNumber(style.spacingAfter, 8, 0, 120)
      const quoteHeight = quoteLines.length * lineHeight
      ensureSpace(spacingBefore + quoteHeight + spacingAfter)
      cursorY -= spacingBefore
      const quoteX = margin + indentPoints
      page.drawRectangle({
        x: quoteX,
        y: cursorY - quoteHeight + 3,
        width: 2.5,
        height: quoteHeight - 2,
        color: parsePdfColor(style.color || theme.quoteColor, theme.quoteColor)
      })
      const quoteFont = resolvePdfFont(fonts, {
        ...style,
        italic: true
      })
      for (const line of quoteLines) {
        page.drawText(line, {
          x: quoteX + 10,
          y: cursorY,
          size,
          font: quoteFont,
          color: parsePdfColor(style.color || theme.quoteColor, theme.quoteColor)
        })
        cursorY -= lineHeight
      }
      cursorY -= spacingAfter
      continue
    }
    if (block.type === 'bullet') {
      const items = block.items.length > 0 ? block.items : [block.text]
      for (let index = 0; index < items.length; index += 1) {
        const isLastItem = index === items.length - 1
        drawWrappedText({
          text: `• ${items[index]}`,
          font: resolvePdfFont(fonts, style),
          size: style.size || theme.bodySize,
          color: style.color ? parsePdfColor(style.color, theme.textColor) : defaultTextColor,
          x: margin + indentPoints,
          maxWidth: bodyMaxWidth - indentPoints,
          spacingBefore: index === 0 ? clampNumber(style.spacingBefore, 2, 0, 120) : 0,
          spacingAfter: isLastItem ? clampNumber(style.spacingAfter, 4, 0, 120) : 2
        })
      }
      continue
    }
    drawWrappedText({
      text: block.text,
      font: resolvePdfFont(fonts, style),
      size: style.size || theme.bodySize,
      color: style.color ? parsePdfColor(style.color, theme.textColor) : defaultTextColor,
      x: margin + indentPoints,
      maxWidth: bodyMaxWidth - indentPoints,
      spacingBefore: clampNumber(style.spacingBefore, 2, 0, 120),
      spacingAfter: clampNumber(style.spacingAfter, 6, 0, 120)
    })
  }
  const pdfBytes = await pdfDocument.save()
  await fs.writeFile(targetPath, Buffer.from(pdfBytes))
  const stats = await fs.stat(targetPath)
  return {
    path: targetPath,
    fileSize: stats.size,
    pages: pdfDocument.getPageCount(),
    blocks: blocks.length
  }
}
