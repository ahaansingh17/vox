import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronDown, Square } from 'lucide-react'
import { getGreeting } from '../helpers'
import { useMessageCache, useChatStreamStatus } from '../../shared/hooks/useChat'
import { useTextareaAutosize } from '../../shared/hooks/useTextareaAutosize'
import OverlayMessage from './OverlayMessage'
const OVERLAY_INPUT_MAX_HEIGHT = 100

const OverlayComposer = memo(function OverlayComposer({ phase }) {
  const inputRef = useRef(null)
  const [hasContent, setHasContent] = useState(false)
  const { resizeNow, scheduleResize } = useTextareaAutosize(OVERLAY_INPUT_MAX_HEIGHT)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = useCallback(async () => {
    const element = inputRef.current
    const text = element?.value.trim() || ''

    if (!text || phase !== 'idle') return

    if (element) {
      element.value = ''
      resizeNow(element)
    }

    setHasContent(false)

    try {
      await window.api.chat.sendMessage(text)
    } catch {
      void 0
    }
  }, [phase, resizeNow])

  const handleAbort = useCallback(async () => {
    try {
      await window.api?.chat?.abort?.()
    } catch {
      void 0
    }
  }, [])

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        void handleSend()
      }

      if (event.key === 'Escape') {
        window.api?.overlay?.hide?.()
      }
    },
    [handleSend]
  )

  const handleInput = useCallback(() => {
    const element = inputRef.current
    scheduleResize(element)

    const nextHasContent = (element?.value.trim().length ?? 0) > 0
    setHasContent((prev) => (prev === nextHasContent ? prev : nextHasContent))
  }, [scheduleResize])

  const isActive = phase !== 'idle'
  const canSend = hasContent && !isActive

  return (
    <div className="overlay-input-area">
      <div className="overlay-input-pill">
        <textarea
          ref={inputRef}
          className="overlay-input"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={isActive ? 'Working...' : 'Ask Vox anything...'}
          rows={1}
          disabled={isActive && phase === 'sending'}
        />

        {isActive ? (
          <button
            className="overlay-send-btn overlay-send-btn-stop"
            onClick={handleAbort}
            type="button"
            title="Stop"
          >
            <Square size={10} fill="currentColor" />
          </button>
        ) : (
          <button
            className="overlay-send-btn overlay-send-btn-primary"
            onClick={() => void handleSend()}
            disabled={!canSend}
            type="button"
            title="Send (Enter)"
          >
            <ArrowUp size={14} />
          </button>
        )}
      </div>
    </div>
  )
})

export default function OverlayChatView() {
  const {
    messages,
    isReady: messagesReady,
    hasMore: hasMoreMessages,
    loadingOlder,
    loadOlder
  } = useMessageCache()
  const { phase } = useChatStreamStatus()

  const [copiedId, setCopiedId] = useState(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const scrollRef = useRef(null)
  const isAtBottomRef = useRef(true)
  const prevMsgCountRef = useRef(0)
  const prevScrollHeightRef = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) {
      prevMsgCountRef.current = messages.length
      return
    }

    const prevCount = prevMsgCountRef.current
    const wasPrepend = messages.length > prevCount && prevCount > 0 && !isAtBottomRef.current

    if (wasPrepend) {
      const addedHeight = el.scrollHeight - prevScrollHeightRef.current
      if (addedHeight > 0) {
        el.scrollTop += addedHeight
      }
    } else if (isAtBottomRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      })
    }

    prevMsgCountRef.current = messages.length
    prevScrollHeightRef.current = el.scrollHeight
  }, [messages])

  useEffect(() => {
    if (phase !== 'streaming' && phase !== 'sending') return
    if (!isAtBottomRef.current) return
    const el = scrollRef.current
    if (el) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      })
    }
  }, [phase, messages])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    isAtBottomRef.current = atBottom
    setIsAtBottom(atBottom)
    if (el.scrollTop < 50 && hasMoreMessages && !loadingOlder) {
      prevScrollHeightRef.current = el.scrollHeight
      loadOlder()
    }
  }, [hasMoreMessages, loadingOlder, loadOlder])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [])

  const handleCopy = useCallback((id, content) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500)
  }, [])

  return (
    <>
      {!messagesReady ? (
        <div className="overlay-skeleton">
          <div className="overlay-skeleton-row">
            <div className="overlay-skeleton-lines" style={{ maxWidth: '65%' }}>
              <div className="overlay-skeleton-line" style={{ width: '90%' }} />
              <div className="overlay-skeleton-line" style={{ width: '70%' }} />
              <div className="overlay-skeleton-line" style={{ width: '40%' }} />
            </div>
          </div>
          <div className="overlay-skeleton-row overlay-skeleton-row-right">
            <div className="overlay-skeleton-bubble" style={{ width: '45%' }} />
          </div>
          <div className="overlay-skeleton-row">
            <div className="overlay-skeleton-lines" style={{ maxWidth: '72%' }}>
              <div className="overlay-skeleton-line" style={{ width: '100%' }} />
              <div className="overlay-skeleton-line" style={{ width: '80%' }} />
            </div>
          </div>
          <div className="overlay-skeleton-row overlay-skeleton-row-right">
            <div className="overlay-skeleton-bubble" style={{ width: '35%' }} />
          </div>
          <div className="overlay-skeleton-row">
            <div className="overlay-skeleton-lines" style={{ maxWidth: '55%' }}>
              <div className="overlay-skeleton-line" style={{ width: '100%' }} />
              <div className="overlay-skeleton-line" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      ) : messages.length === 0 ? (
        <div className="overlay-empty">
          <span className="overlay-empty-title">{getGreeting()}.</span>
          <span className="overlay-empty-subtitle">Ask me anything</span>
        </div>
      ) : (
        <div className="overlay-messages-wrap">
          <div className="overlay-messages" ref={scrollRef} onScroll={handleScroll}>
            {loadingOlder && (
              <div className="overlay-skeleton" style={{ padding: '0 0 4px', gap: '10px' }}>
                <div className="overlay-skeleton-row">
                  <div className="overlay-skeleton-lines" style={{ maxWidth: '60%' }}>
                    <div className="overlay-skeleton-line" style={{ width: '90%' }} />
                    <div className="overlay-skeleton-line" style={{ width: '55%' }} />
                  </div>
                </div>
                <div className="overlay-skeleton-row overlay-skeleton-row-right">
                  <div className="overlay-skeleton-bubble" style={{ width: '40%' }} />
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <OverlayMessage key={msg.id} msg={msg} copiedId={copiedId} onCopy={handleCopy} />
            ))}
          </div>
          {!isAtBottom && (
            <button
              className="overlay-scroll-fab"
              onClick={scrollToBottom}
              type="button"
              aria-label="Scroll to bottom"
            >
              <ChevronDown size={14} />
            </button>
          )}
        </div>
      )}

      <OverlayComposer phase={phase} />
    </>
  )
}
