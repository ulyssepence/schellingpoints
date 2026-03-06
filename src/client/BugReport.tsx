import * as React from 'react'

type Props = {
  open: boolean
  onClose: () => void
  stackTrace?: string
}

export function BugReport({ open, onClose, stackTrace }: Props) {
  const [description, setDescription] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  if (!open) return null

  async function handleSubmit() {
    if (!description.trim() && !stackTrace) return
    setSending(true)
    try {
      await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          context: {
            url: window.location.href,
            userAgent: navigator.userAgent,
            appVersion: import.meta.env.APP_VERSION ?? 'unknown',
          },
          stackTrace,
        }),
      })
      setSent(true)
      setTimeout(() => {
        setSent(false)
        setDescription('')
        onClose()
      }, 1500)
    } catch {
      alert('Failed to send bug report')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bug-report-overlay" onClick={onClose}>
      <div className="bug-report-modal" onClick={e => e.stopPropagation()}>
        <h2>Report a Bug</h2>
        {stackTrace && <pre className="bug-report-stack">{stackTrace}</pre>}
        <textarea
          className="input bug-report-textarea"
          placeholder="What happened?"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
        />
        <div className="bug-report-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={sending}>
            {sent ? 'Sent!' : sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

export const BugReportContext = React.createContext<{
  open: boolean
  setOpen: (v: boolean) => void
}>({ open: false, setOpen: () => {} })

export function BugReportProvider({ children, onMount }: { children: React.ReactNode, onMount?: (setOpen: (v: boolean) => void) => void }) {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => { onMount?.(setOpen) }, [])
  return (
    <BugReportContext.Provider value={{ open, setOpen }}>
      {children}
      <BugReport open={open} onClose={() => setOpen(false)} />
    </BugReportContext.Provider>
  )
}

export function BugButton() {
  const { setOpen } = React.useContext(BugReportContext)
  return (
    <button className="btn-icon" onClick={() => setOpen(true)} aria-label="Report bug">
      <svg className="icon" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeLinejoin="round">
        <path d="M8 2l1.88 1.88" /><path d="M14.12 3.88L16 2" />
        <path d="M9 7.13v-1a3.003 3.003 0 116 0v1" />
        <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6" />
        <path d="M12 20v-9" />
        <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
        <path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
        <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
        <path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
      </svg>
    </button>
  )
}
