import { desktopCapturer, screen, shell, systemPreferences } from 'electron'
import { exec } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
const execAbortable = (command, options = {}, signal) => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'))
      return
    }
    const child = exec(command, options, (error, stdout, stderr) => {
      if (signal) signal.removeEventListener('abort', onAbort)
      if (error)
        reject(
          Object.assign(error, {
            stderr
          })
        )
      else
        resolve({
          stdout,
          stderr
        })
    })
    const onAbort = () => {
      try {
        child.kill('SIGTERM')
      } catch {
        void 0
      }
    }
    if (signal)
      signal.addEventListener('abort', onAbort, {
        once: true
      })
  })
}
export const waitForScreenPermission = async (signal) => {
  const initial = systemPreferences.getMediaAccessStatus('screen')
  if (initial === 'granted') return
  await desktopCapturer
    .getSources({
      types: ['screen'],
      thumbnailSize: {
        width: 1,
        height: 1
      }
    })
    .catch(() => {})
  await shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
  )
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('Aborted')
    await new Promise((r) => setTimeout(r, 500))
    if (systemPreferences.getMediaAccessStatus('screen') === 'granted') return
  }
  throw new Error(
    'Screen recording permission was not granted. Please allow access in System Settings → Privacy & Security → Screen Recording.'
  )
}
export const captureFullScreen = async (_, { signal } = {}) => {
  await waitForScreenPermission(signal)
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.size
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width,
      height
    }
  })
  const primary = sources[0]
  if (!primary) throw new Error('No screen source available for capture.')
  const captureSize = primary.thumbnail.getSize()
  const base64Image = primary.thumbnail.toJPEG(75).toString('base64')
  return {
    text: `Captured full screen (${captureSize.width}x${captureSize.height}). Coordinates in this image map directly to click_at screen coordinates.`,
    imageBase64: base64Image,
    mimeType: 'image/jpeg'
  }
}
export const captureRegion = async ({ x, y, width, height }, { signal } = {}) => {
  await waitForScreenPermission(signal)
  const xi = Math.round(Number(x))
  const yi = Math.round(Number(y))
  const wi = Math.round(Number(width))
  const hi = Math.round(Number(height))
  const tmpFile = path.join(os.tmpdir(), `vox_region_${Date.now()}.jpg`)
  try {
    await execAbortable(
      `screencapture -R ${xi},${yi},${wi},${hi} -t jpg "${tmpFile}"`,
      {
        timeout: 10_000
      },
      signal
    )
    const buffer = await fs.readFile(tmpFile)
    return {
      text: `Captured region (${wi}x${hi}) at (${xi},${yi}). Coordinates map directly to click_at screen coordinates.`,
      imageBase64: buffer.toString('base64'),
      mimeType: 'image/jpeg'
    }
  } finally {
    await fs.unlink(tmpFile).catch(() => {})
  }
}
