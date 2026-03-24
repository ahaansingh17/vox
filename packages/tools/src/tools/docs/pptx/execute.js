import fs from 'fs/promises'
import path from 'path'
import PptxGenJS from 'pptxgenjs'
import {
  resolveDocumentContent,
  resolvePathInputFromPayload,
  resolvePathWithExtension
} from '../utils.js'
import { normalizePresentationTheme, resolveSlideTheme } from './pptx-theme.js'
import { normalizePresentationSlides } from './pptx-slides.js'
const slideStageMap = new Map()
export async function createPresentationDocument(payload) {
  const safePayload = payload && typeof payload === 'object' ? payload : {}
  const pathInput = resolvePathInputFromPayload(safePayload)
  if (!pathInput) {
    throw new Error('Path is required. Provide path/filePath/targetPath, or directory + filename.')
  }
  const targetPath = resolvePathWithExtension(pathInput, '.pptx')
  const title = String(safePayload?.title || '').trim()
  const includeTitleSlide = Boolean(
    safePayload?.includeTitleSlide || safePayload?.addTitleSlide || safePayload?.coverSlide
  )
  const appendMode = Boolean(safePayload?.append)
  const finalize = safePayload?.finalize !== false
  const resolvedContent = resolveDocumentContent(safePayload)
  const shouldCreateParents = safePayload?.createParents !== false
  const deckTheme = normalizePresentationTheme(safePayload?.theme)
  const newSlides = normalizePresentationSlides(safePayload)
  if (appendMode) {
    const existing = slideStageMap.get(targetPath)
    if (existing) {
      existing.slides.push(...newSlides)
    } else {
      slideStageMap.set(targetPath, {
        theme: deckTheme,
        title,
        includeTitleSlide,
        slides: [...newSlides]
      })
    }
    if (!finalize) {
      return {
        path: targetPath,
        staged: slideStageMap.get(targetPath)?.slides.length ?? 0,
        written: false
      }
    }
  }
  let allSlides
  let finalTheme = deckTheme
  let finalTitle = title
  let finalIncludeTitleSlide = includeTitleSlide
  if (appendMode && slideStageMap.has(targetPath)) {
    const staged = slideStageMap.get(targetPath)
    allSlides = staged.slides
    finalTheme = staged.theme
    finalTitle = staged.title || title
    finalIncludeTitleSlide = staged.includeTitleSlide || includeTitleSlide
    slideStageMap.delete(targetPath)
  } else {
    allSlides = newSlides
  }
  if (shouldCreateParents) {
    await fs.mkdir(path.dirname(targetPath), {
      recursive: true
    })
  }
  if (allSlides.length === 0 && !resolvedContent.trim()) {
    throw new Error(
      'No presentation content provided. Pass slides/content (or body/text/markdown). Title-only payloads are not allowed.'
    )
  }
  const presentation = new PptxGenJS()
  presentation.layout = 'LAYOUT_WIDE'
  presentation.author = 'Vox'
  presentation.subject = finalTitle || 'Generated presentation'
  presentation.title = finalTitle || 'Generated presentation'
  presentation.company = 'Vox'
  let slideCount = 0
  const addStyledSlide = (slideData, overrideStyle = null) => {
    const slide = presentation.addSlide()
    slideCount += 1
    const theme = resolveSlideTheme(finalTheme, overrideStyle || slideData.style)
    slide.addShape(presentation.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
      fill: {
        color: theme.backgroundColor
      },
      line: {
        color: theme.backgroundColor
      }
    })
    slide.addShape(presentation.ShapeType.line, {
      x: 0.55,
      y: 0.6,
      w: 12.2,
      h: 0,
      line: {
        color: theme.accentColor,
        pt: 1.2
      }
    })
    const titleY = 0.75
    slide.addText(slideData.title, {
      x: 0.7,
      y: titleY,
      w: 11.9,
      h: 0.75,
      fontFace: theme.titleFontFace,
      fontSize: theme.titleSize,
      color: theme.titleColor,
      bold: true
    })
    let contentTop = 1.75
    if (slideData.subtitle) {
      slide.addText(slideData.subtitle, {
        x: 0.72,
        y: 1.45,
        w: 11.6,
        h: 0.45,
        fontFace: theme.bodyFontFace,
        fontSize: theme.subtitleSize,
        color: theme.subtitleColor
      })
      contentTop = 2.0
    }
    const bodyText = slideData.body
    const bulletText = slideData.bullets.map((item) => `• ${item}`).join('\n')
    const hasBody = Boolean(bodyText)
    const hasBullets = Boolean(bulletText)
    const isSplitLayout = theme.layout === 'split' && (hasBody || hasBullets)
    if (isSplitLayout) {
      if (hasBody) {
        slide.addText(bodyText, {
          x: 0.75,
          y: contentTop,
          w: 5.7,
          h: 4.95,
          fontFace: theme.bodyFontFace,
          fontSize: theme.bodySize,
          color: theme.bodyColor,
          valign: 'top'
        })
      }
      if (hasBullets) {
        slide.addText(bulletText, {
          x: 6.8,
          y: contentTop,
          w: 5.75,
          h: 4.95,
          fontFace: theme.bodyFontFace,
          fontSize: Math.max(theme.bodySize - 1, 10),
          color: theme.bodyColor,
          valign: 'top'
        })
      }
      return
    }
    if (hasBody) {
      slide.addText(bodyText, {
        x: 0.75,
        y: contentTop,
        w: 11.9,
        h: hasBullets ? 2.2 : 4.95,
        fontFace: theme.bodyFontFace,
        fontSize: theme.bodySize,
        color: theme.bodyColor,
        valign: 'top'
      })
    }
    if (hasBullets) {
      slide.addText(bulletText, {
        x: 0.82,
        y: hasBody ? contentTop + 2.35 : contentTop,
        w: 11.5,
        h: hasBody ? 2.6 : 4.95,
        fontFace: theme.bodyFontFace,
        fontSize: Math.max(theme.bodySize - 1, 10),
        color: theme.bodyColor,
        valign: 'top'
      })
    }
  }
  if (finalTitle && finalIncludeTitleSlide) {
    addStyledSlide({
      title: finalTitle,
      subtitle: 'Generated by Vox',
      body: '',
      bullets: [],
      style: {
        layout: 'standard',
        titleSize: Math.max(finalTheme.titleSize + 4, 24),
        bodySize: Math.max(finalTheme.bodySize - 2, 14)
      }
    })
  }
  for (const slideData of allSlides) {
    addStyledSlide(slideData)
  }
  await presentation.writeFile({
    fileName: targetPath
  })
  const stats = await fs.stat(targetPath)
  return {
    path: targetPath,
    fileSize: stats.size,
    slides: slideCount
  }
}
