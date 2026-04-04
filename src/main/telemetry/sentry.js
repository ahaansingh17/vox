import * as Sentry from '@sentry/electron/main'
import { is } from '@electron-toolkit/utils'
import { isSentryEnabled, sentryBeforeSend, sentryDsn } from '../../shared/sentry.config'

let initialized = false

const withScopeContext = (options, callback) => {
  Sentry.withScope((scope) => {
    scope.setTag('process', 'main')

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

    callback(scope)
  })
}

export const initMainSentry = () => {
  if (initialized) {
    return
  }

  Sentry.init({
    dsn: sentryDsn,
    enabled: isSentryEnabled(is.dev),
    beforeSend: sentryBeforeSend,
    initialScope: {
      tags: {
        process: 'main'
      }
    }
  })

  initialized = true
}

export const addMainBreadcrumb = (message, level = 'info') => {
  Sentry.addBreadcrumb({
    message: String(message),
    level
  })
}

export const captureMainException = (error, options) => {
  withScopeContext(options, () => {
    Sentry.captureException(error)
  })
}

export const captureMainMessage = (message, options) => {
  withScopeContext(options, () => {
    Sentry.captureMessage(String(message), options?.level || 'info')
  })
}
