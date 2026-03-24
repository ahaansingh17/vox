import { resolveDocumentContent } from '../utils.js'

export const parseSlidesFromContent = (content) => {
  const rawSlides = String(content || '')
    .split(/\n\s*---\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean)
  return rawSlides.map((rawSlide, index) => {
    const lines = rawSlide
      .split(/\r?\n/)
      .map((line) => String(line || '').trim())
      .filter(Boolean)
    const titleLine = lines[0] || `Slide ${index + 1}`
    const contentLines = lines.slice(1)
    const bulletLines = contentLines
      .filter((line) => /^[-*]\s+/.test(line))
      .map((line) => line.replace(/^[-*]\s+/, '').trim())
      .filter(Boolean)
    const bodyLines = contentLines.filter((line) => !/^[-*]\s+/.test(line))
    return {
      title: titleLine.replace(/^#+\s*/, ''),
      subtitle: '',
      body: bodyLines.join('\n').trim(),
      bullets: bulletLines,
      style: {}
    }
  })
}

export const normalizePresentationSlides = (payload) => {
  const providedSlides = Array.isArray(payload?.slides) ? payload.slides : []
  const resolvedContent = resolveDocumentContent(payload)
  const sourceSlides =
    providedSlides.length > 0 ? providedSlides : parseSlidesFromContent(resolvedContent)
  return sourceSlides
    .map((slide, index) => {
      const safeSlide = slide && typeof slide === 'object' ? slide : {}
      const title = String(
        safeSlide.title || safeSlide.heading || safeSlide.header || safeSlide.name || ''
      ).trim()
      const subtitle = String(
        safeSlide.subtitle || safeSlide.subheading || safeSlide.summary || ''
      ).trim()
      const body = String(
        safeSlide.body || safeSlide.content || safeSlide.text || safeSlide.description || ''
      ).trim()
      const bullets =
        Array.isArray(safeSlide.bullets) && safeSlide.bullets.length > 0
          ? safeSlide.bullets.map((item) => String(item || '').trim()).filter(Boolean)
          : Array.isArray(safeSlide.points) && safeSlide.points.length > 0
            ? safeSlide.points.map((item) => String(item || '').trim()).filter(Boolean)
            : Array.isArray(safeSlide.items) && safeSlide.items.length > 0
              ? safeSlide.items.map((item) => String(item || '').trim()).filter(Boolean)
              : []
      if (!title && !subtitle && !body && bullets.length === 0) return null
      return {
        title: title || `Slide ${index + 1}`,
        subtitle,
        body,
        bullets,
        style: safeSlide.style && typeof safeSlide.style === 'object' ? safeSlide.style : {}
      }
    })
    .filter(Boolean)
}
