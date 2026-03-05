import * as React from 'react'
import * as features from './features'

export function DebugMenu() {
  if (import.meta.env.APP_VERSION !== 'dev') return null

  const [open, setOpen] = React.useState(false)
  const [flags, setFlags] = React.useState(features.getFlags)

  function toggle(key: string) {
    setFlags(f => ({ ...f, [key]: !f[key as keyof typeof f] }))
  }

  function apply() {
    features.setFlags(flags)
    window.location.reload()
  }

  return <>
    <button className="debug-gear" onClick={() => setOpen(!open)}>⚙</button>
    {open && <div className="debug-menu">
      <h3>Juice Flags</h3>
      <label>
        <input type="checkbox" checked={flags.allJuice} onChange={() => toggle('allJuice')} />
        All Juice (master)
      </label>
      <hr />
      {features.FLAG_NAMES.map(name => (
        <label key={name}>
          <input type="checkbox" checked={flags[name]} onChange={() => toggle(name)} />
          {name}
        </label>
      ))}
      <button className="btn debug-apply" onClick={apply}>Apply &amp; Reload</button>
    </div>}
  </>
}
