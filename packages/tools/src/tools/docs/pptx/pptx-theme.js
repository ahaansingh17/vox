import { clampNumber, normalizeHexColor } from '../utils.js'

export const normalizePresentationTheme = (theme) => {
  const safeTheme = theme && typeof theme === 'object' ? theme : {}
  return {
    backgroundColor: normalizeHexColor(safeTheme.backgroundColor, 'FFFFFF'),
    titleColor: normalizeHexColor(safeTheme.titleColor, '111827'),
    subtitleColor: normalizeHexColor(safeTheme.subtitleColor, '475569'),
    bodyColor: normalizeHexColor(safeTheme.bodyColor, '1F2937'),
    accentColor: normalizeHexColor(safeTheme.accentColor, 'DB2777'),
    titleSize: clampNumber(safeTheme.titleSize, 34, 14, 60),
    subtitleSize: clampNumber(safeTheme.subtitleSize, 18, 10, 42),
    bodySize: clampNumber(safeTheme.bodySize, 20, 10, 40),
    titleFontFace: String(safeTheme.titleFontFace || 'Calibri').trim() || 'Calibri',
    bodyFontFace: String(safeTheme.bodyFontFace || 'Calibri').trim() || 'Calibri',
    layout: String(safeTheme.layout || 'standard')
      .trim()
      .toLowerCase()
  }
}

export const resolveSlideTheme = (deckTheme, style) => {
  const slideStyle = style && typeof style === 'object' ? style : {}
  return {
    backgroundColor: normalizeHexColor(slideStyle.backgroundColor, deckTheme.backgroundColor),
    titleColor: normalizeHexColor(slideStyle.titleColor, deckTheme.titleColor),
    subtitleColor: normalizeHexColor(slideStyle.subtitleColor, deckTheme.subtitleColor),
    bodyColor: normalizeHexColor(slideStyle.bodyColor, deckTheme.bodyColor),
    accentColor: normalizeHexColor(slideStyle.accentColor, deckTheme.accentColor),
    titleSize: clampNumber(slideStyle.titleSize, deckTheme.titleSize, 12, 72),
    subtitleSize: clampNumber(slideStyle.subtitleSize, deckTheme.subtitleSize, 10, 48),
    bodySize: clampNumber(slideStyle.bodySize, deckTheme.bodySize, 10, 44),
    titleFontFace: String(slideStyle.titleFontFace || deckTheme.titleFontFace).trim(),
    bodyFontFace: String(slideStyle.bodyFontFace || deckTheme.bodyFontFace).trim(),
    layout: String(slideStyle.layout || deckTheme.layout || 'standard')
      .trim()
      .toLowerCase()
  }
}
