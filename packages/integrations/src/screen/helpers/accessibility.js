import { systemPreferences, shell } from 'electron'

const openAccessibilitySettings = () => {
  shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
  )
}

export const ensureAccessibility = () => {
  const trusted = systemPreferences.isTrustedAccessibilityClient(false)
  if (!trusted) {
    const prompted = systemPreferences.isTrustedAccessibilityClient(true)
    if (!prompted) {
      openAccessibilitySettings()
      throw Object.assign(
        new Error(
          'Vox needs Accessibility permission to control the screen. Opening System Settings → Privacy & Security → Accessibility — please enable it for Vox and try again.'
        ),
        {
          code: 'ACCESSIBILITY_REQUIRED'
        }
      )
    }
  }
}
