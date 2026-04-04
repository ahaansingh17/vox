import * as Sentry from '@sentry/electron/renderer'
import { sentryBeforeSend, sentryDsn } from '../../../shared/sentry.config'

export const initRendererSentry = (processName) => {
  Sentry.init({
    dsn: sentryDsn,
    enabled: !import.meta.env.DEV,
    beforeSend: sentryBeforeSend,
    initialScope: {
      tags: {
        process: processName || 'renderer'
      }
    }
  })
}

export const captureRendererException = (error, options) => {
  Sentry.withScope((scope) => {
    scope.setTag('process', options?.process || 'renderer')

    if (options?.area) {
      scope.setTag('area', options.area)
    }

    if (options?.phase) {
      scope.setTag('phase', options.phase)
    }

    if (options?.level) {
      scope.setLevel(options.level)
    }

    if (options?.context) {
      scope.setContext(options.area || 'context', options.context)
    }

    Sentry.captureException(error)
  })
}
