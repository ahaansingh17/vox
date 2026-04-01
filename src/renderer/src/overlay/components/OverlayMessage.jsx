import { memo } from 'react'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const REMARK_PLUGINS = [remarkGfm]

function OverlayPill({ msg }) {
  return (
    <div
      className={`overlay-activity-pill ${
        msg.pillType === 'success'
          ? 'overlay-activity-pill-success'
          : msg.pillType === 'error'
            ? 'overlay-activity-pill-error'
            : 'overlay-activity-pill-tool'
      }`}
    >
      {msg.pillType === 'tool' && <span className="overlay-pill-icon">&#x1f527;</span>}
      {msg.pillType === 'success' && <span className="overlay-pill-icon">&#x2713;</span>}
      {msg.pillType === 'error' && <span className="overlay-pill-icon">&#x2717;</span>}
      <span>{msg.content}</span>
    </div>
  )
}

function OverlayAssistantMessage({ msg, copiedId, onCopy }) {
  return (
    <div className="overlay-msg overlay-msg-assistant">
      {msg.pending && !msg.content?.trim() ? (
        <div className="overlay-thinking-container">
          <div className="overlay-thinking-dots">
            <span />
            <span />
            <span />
          </div>
          <span className="overlay-thinking-text">Thinking</span>
        </div>
      ) : msg.pending ? (
        <p className="overlay-msg-pending" style={{ margin: 0 }}>
          {msg.content}
        </p>
      ) : (
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{msg.content}</ReactMarkdown>
      )}
      {!msg.pending && msg.content?.trim() && (
        <button
          className={`overlay-copy-btn${copiedId === msg.id ? ' overlay-copy-btn-done' : ''}`}
          onClick={() => onCopy(msg.id, msg.content)}
          type="button"
        >
          {copiedId === msg.id ? (
            <>
              <Check size={10} /> Copied
            </>
          ) : (
            <>
              <Copy size={10} /> Copy
            </>
          )}
        </button>
      )}
    </div>
  )
}

export default memo(function OverlayMessage({ msg, copiedId, onCopy }) {
  if (msg.role === 'pill') {
    return <OverlayPill msg={msg} />
  }

  if (msg.role === 'system' || msg.role === 'notification') {
    return <div className="overlay-msg overlay-msg-system">{msg.content}</div>
  }

  if (msg.role === 'user') {
    return <div className="overlay-msg overlay-msg-user">{msg.content}</div>
  }

  return <OverlayAssistantMessage msg={msg} copiedId={copiedId} onCopy={onCopy} />
})
