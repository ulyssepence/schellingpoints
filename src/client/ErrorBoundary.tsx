import * as React from 'react'

type State = { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      const stack = this.state.error.stack ?? this.state.error.message
      return <InlineBugReport stackTrace={stack} onClose={() => this.setState({ error: null })} />
    }
    return this.props.children
  }
}

function InlineBugReport({ stackTrace, onClose }: { stackTrace: string; onClose: () => void }) {
  const [description, setDescription] = React.useState('')
  const [status, setStatus] = React.useState<'idle' | 'sending' | 'sent'>('idle')

  function handleSubmit() {
    if (!description.trim() && !stackTrace) return
    setStatus('sending')
    fetch('/api/bug-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        context: { url: window.location.href, userAgent: navigator.userAgent },
        stackTrace,
      }),
    }).then(() => {
      setStatus('sent')
      setTimeout(onClose, 1500)
    }).catch(() => alert('Failed to send bug report'))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', padding: 20, gap: 12 }}>
      <h1 style={{ fontFamily: 'var(--font-fancy)', fontSize: '2rem', color: 'var(--cream)' }}>Something went wrong</h1>
      <pre style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', maxHeight: 100, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', width: '100%' }}>{stackTrace}</pre>
      <textarea
        placeholder="What happened?"
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={3}
        style={{ width: '100%', maxWidth: 380, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'var(--cream)', fontFamily: 'var(--font-body)', fontSize: '0.85rem', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 380 }}>
        <button className="btn" onClick={handleSubmit} disabled={status === 'sending'} style={{ flex: 1 }}>
          {status === 'sent' ? 'Sent!' : status === 'sending' ? 'Sending...' : 'Send'}
        </button>
        <button className="btn" onClick={onClose} style={{ flex: 1 }}>Dismiss</button>
      </div>
    </div>
  )
}
