/* ============================================================================
   CADENCE — shared wireframe kit
   Design tokens (Signal/dark + Pulse/light), theme scope, and all UI primitives.
   Imported by every screen via <script type="text/babel" src=".../cadence-kit.jsx">.
   Exposes components on window so screen files can use them directly.
   ============================================================================ */

/* ---- One-time token + base style injection -------------------------------- */
if (typeof document !== 'undefined' && !document.getElementById('cad-tokens')) {
  const s = document.createElement('style');
  s.id = 'cad-tokens';
  s.textContent = `
  .cad{
    /* shared */
    --success:#34D399; --error:#EF4444; --warning:#F59E0B;
    --radius-input:12px; --radius-card:16px; --radius-pill:40px;
    font-family:'DM Sans',system-ui,sans-serif;
    -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
  }
  .cad[data-theme="signal"]{
    --bg:#0C0C0F; --surface:#16161C; --surface2:#1E1E28; --border:#2A2A36;
    --text:#EEEEF5; --text-sub:#9090A8; --text-muted:#50506A;
    --accent:oklch(0.62 0.22 22); --accent-dim:oklch(0.18 0.06 22);
    --pill-bg:#252534; --pill-text:#BBBBCC;
    --btn-primary-bg:oklch(0.62 0.22 22); --btn-primary-text:#0C0C0F;
    --stripe:4px; --shadow:0 1px 0 rgba(255,255,255,.02);
  }
  .cad[data-theme="pulse"]{
    --bg:#F6F6F8; --surface:#FFFFFF; --surface2:#F0F0F4; --border:#E4E4EC;
    --text:#111118; --text-sub:#707088; --text-muted:#A0A0B4;
    --accent:oklch(0.52 0.22 22); --accent-dim:oklch(0.95 0.06 22);
    --pill-bg:#EBEBF2; --pill-text:#404058;
    --btn-primary-bg:#111118; --btn-primary-text:#FFFFFF;
    --stripe:6px; --shadow:0 1px 2px rgba(17,17,24,.05);
  }
  .cad, .cad *{ box-sizing:border-box; }
  .cad .mono{ font-family:'DM Mono',ui-monospace,monospace; font-feature-settings:"tnum" 1; }
  .cad ::placeholder{ color:var(--text-muted); }
  .cad button{ font-family:inherit; }
  .cad-screen{ position:relative; width:390px; background:var(--bg); color:var(--text); overflow:hidden; }
  .cad-scroll{ overflow-y:auto; }
  /* focus ring used on inputs / interactive */
  .cad-focus{ box-shadow:0 0 0 3px color-mix(in oklch, var(--accent) 28%, transparent); }
  `;
  document.head.appendChild(s);
}

const { useState, useRef, useEffect } = React;
const PX = 20; // horizontal screen padding

/* ---------------------------------------------------------------- ThemeScope */
// Wraps a phone screen. Sets theme vars + base bg/color. height is the artboard's.
function Screen({ theme = 'signal', children, height = 844, scroll = false, pad = false, style = {} }) {
  return (
    <div className="cad" data-theme={theme}>
      <div className={'cad-screen' + (scroll ? ' cad-scroll' : '')}
           style={{ height, ...(pad ? { padding: `0 ${PX}px` } : {}), ...style }}>
        {children}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- StatusBar */
function StatusBar({ time = '9:41' }) {
  return (
    <div style={{ height: 47, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0 24px 0 28px', flex: '0 0 auto' }}>
      <span className="mono" style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text)' }}>{time}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {/* cellular */}
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
          {[3,6,9,12].map((h,i)=>(<rect key={i} x={i*4.5} y={12-h} width="3" height={h} rx="1" fill="var(--text)"/>))}
        </svg>
        {/* wifi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path d="M8 11.2 9.8 9c-1-.9-2.6-.9-3.6 0L8 11.2Z" fill="var(--text)"/>
          <path d="M3.6 6.4C6.1 4 9.9 4 12.4 6.4" stroke="var(--text)" strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M1.4 4.1C5.1.5 10.9.5 14.6 4.1" stroke="var(--text)" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
        {/* battery */}
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="var(--text)" opacity="0.4"/>
          <rect x="2" y="2" width="17" height="8" rx="1.6" fill="var(--text)"/>
          <rect x="24" y="4" width="1.6" height="4" rx="0.8" fill="var(--text)" opacity="0.5"/>
        </svg>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- Icons */
const Icon = {
  back:    (p)=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chevron: (p)=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  arrow:   (p)=> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  eye:     (p)=> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8"/></svg>,
  eyeOff:  (p)=> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}><path d="M3 3l18 18M10.6 10.7a2.6 2.6 0 0 0 3.6 3.6M9.4 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.3 4.1M6.2 6.3A16 16 0 0 0 2 12s3.5 7 10 7a9.4 9.4 0 0 0 3-.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  apple:   (p)=> <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M16.4 12.7c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.5 2.2 2.6 2.2 1 0 1.4-.7 2.7-.7s1.6.7 2.7.6c1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4-.1 0-2.1-.8-2.1-3.1ZM14.2 6.3c.6-.7 1-1.7.9-2.7-.8 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6.9.1 1.8-.5 2.5-1.2Z"/></svg>,
  dumbbell:(p)=> <svg width="26" height="26" viewBox="0 0 24 24" fill="none" {...p}><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  clipboard:(p)=> <svg width="26" height="26" viewBox="0 0 24 24" fill="none" {...p}><rect x="5" y="4" width="14" height="17" rx="2.5" stroke="currentColor" strokeWidth="2"/><path d="M9 4.5a3 3 0 0 1 6 0M9 11h6M9 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  lock:    (p)=> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" stroke="currentColor" strokeWidth="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="2"/></svg>,
  check:   (p)=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  mail:    (p)=> <svg width="28" height="28" viewBox="0 0 24 24" fill="none" {...p}><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  up:      (p)=> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}><path d="M12 19V6M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  home:    (p)=> <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...p}><path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  calendar:(p)=> <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...p}><rect x="4" y="5" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  chart:   (p)=> <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...p}><path d="M5 19V5M5 19h14M9 16v-4M13 16V8M17 16v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  user:    (p)=> <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2"/><path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  users:   (p)=> <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...p}><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M16 6.5a3 3 0 0 1 0 5.6M17 14c2.4.3 4 2.2 4 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  live:    (p)=> <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M6.5 6.5a8 8 0 0 0 0 11M17.5 6.5a8 8 0 0 1 0 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  settings:(p)=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  grip:    (p)=> <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...p}><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>,
  plus:    (p)=> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>,
  copy:    (p)=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><rect x="8" y="8" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="2"/></svg>,
  trash:   (p)=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M7 7l1 13h8l1-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  edit:    (p)=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><path d="M14 5l5 5M4 20l1-4L16 5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  heart:   (p)=> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}><path d="M12 20S4 14.5 4 9.2C4 6.3 6.2 4.5 8.5 4.5c1.6 0 2.8.9 3.5 2 .7-1.1 1.9-2 3.5-2C18.8 4.5 21 6.3 21 9.2 21 14.5 12 20 12 20Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>,
  watch:   (p)=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><rect x="7" y="7" width="10" height="10" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M9 7l.6-3h4.8L15 7M9 17l.6 3h4.8l.6-3" stroke="currentColor" strokeWidth="2"/></svg>,
  globe:   (p)=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" stroke="currentColor" strokeWidth="2"/></svg>,
  bell:    (p)=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  shield:  (p)=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>,
  card:    (p)=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="2"/><path d="M3 10h18" stroke="currentColor" strokeWidth="2"/></svg>,
  info:    (p)=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  key:     (p)=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="2"/><path d="M11 11l8 8M16 16l2-2M14 14l2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
};

/* ------------------------------------------------------------ Resonance logo */
// Two groups of 3 concentric semicircular arcs intersecting (coach ↔ athlete).
function Logo({ size = 64, color = 'var(--accent)', faint = 'var(--text-muted)' }) {
  const cy = 32, lx = 24, rx = 40, radii = [8, 15, 22];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {radii.map((r,i)=>(
        <path key={'l'+i} d={`M${lx},${cy-r} A${r},${r} 0 0 1 ${lx},${cy+r}`} stroke={color}
              strokeWidth={i===0?2.4:2} strokeLinecap="round" opacity={1-i*0.18}/>
      ))}
      {radii.map((r,i)=>(
        <path key={'r'+i} d={`M${rx},${cy+r} A${r},${r} 0 0 1 ${rx},${cy-r}`} stroke={color}
              strokeWidth={i===0?2.4:2} strokeLinecap="round" opacity={1-i*0.18}/>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------- Buttons */
function Btn({ variant = 'primary', children, height = 52, full = true, onClick, icon, style = {} }) {
  const base = { height, width: full ? '100%' : 'auto', borderRadius: 'var(--radius-pill)',
    fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
    border: '1px solid transparent', padding: full ? 0 : '0 22px', transition: 'all .18s', ...style };
  const v = {
    primary:   { background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' },
    secondary: { background: 'var(--surface2)', color: 'var(--text)', borderColor: 'var(--border)' },
    ghost:     { background: 'transparent', color: 'var(--text)', borderColor: 'var(--border)' },
    danger:    { background: 'transparent', color: 'var(--error)', borderColor: 'transparent' },
  }[variant];
  return <button onClick={onClick} style={{ ...base, ...v }}>{icon}{children}</button>;
}

/* -------------------------------------------------------------------- Fields */
function Field({ label, value = '', placeholder, type = 'text', state = 'idle', message, trailing, mono = false }) {
  const borderColor = state === 'error' ? 'var(--error)' : state === 'focus' ? 'var(--accent)' : 'var(--border)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {label && <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-sub)' }}>{label}</label>}
      <div className={state === 'focus' ? 'cad-focus' : ''}
           style={{ display: 'flex', alignItems: 'center', gap: 8, height: 50, padding: '0 14px',
                    background: 'var(--surface)', border: `1.5px solid ${borderColor}`,
                    borderRadius: 'var(--radius-input)', transition: 'border-color .2s, box-shadow .2s' }}>
        <span className={mono ? 'mono' : ''} style={{ flex: 1, fontSize: 14, fontWeight: 500,
              color: value ? 'var(--text)' : 'var(--text-muted)' }}>{value || placeholder}</span>
        {trailing}
      </div>
      {message && <span style={{ fontSize: 12, fontWeight: 500, color: state === 'error' ? 'var(--error)' : 'var(--text-sub)' }}>{message}</span>}
    </div>
  );
}

/* --------------------------------------------------------------------- Pills */
function Pill({ children, active = false, accent = false, style = {} }) {
  const s = active
    ? { background: 'var(--accent)', color: 'var(--btn-primary-text)' }
    : accent
    ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
    : { background: 'var(--pill-bg)', color: 'var(--pill-text)' };
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 12px',
    borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 700, letterSpacing: '-0.005em', ...s, ...style }}>{children}</span>;
}

/* --------------------------------------------------------------------- Cards */
function Card({ children, stripe = false, pad = 16, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{ position: 'relative', background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: pad,
      overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', ...style }}>
      {stripe && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 'var(--stripe)', background: 'var(--accent)' }} />}
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- Progress bar */
function LinearProgress({ value = 0, height = 6 }) {
  return (
    <div style={{ height, background: 'var(--surface2)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: value + '%', height: '100%', background: 'var(--accent)', borderRadius: 999 }} />
    </div>
  );
}

/* ------------------------------------------------------------------- Toggle */
function Toggle({ on = false }) {
  return (
    <div style={{ width: 44, height: 26, borderRadius: 999, padding: 3, flex: '0 0 auto',
      background: on ? 'var(--accent)' : 'var(--surface2)', border: on ? 'none' : '1px solid var(--border)',
      display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'all .2s' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: on ? 'var(--btn-primary-text)' : 'var(--text-sub)' }} />
    </div>
  );
}

/* ----------------------------------------------------------- Section heading */
function SectionLabel({ children, style = {} }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
    color: 'var(--text-sub)', ...style }}>{children}</div>;
}

/* -------------------------------------------------------------------- TopBar */
function TopBar({ title, onBack = true, right, big = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 52, padding: `0 ${PX}px`, flex: '0 0 auto' }}>
      {onBack && <button style={{ width: 36, height: 36, marginLeft: -8, border: 'none', background: 'transparent',
        color: 'var(--text)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}><Icon.back /></button>}
      <div style={{ flex: 1, fontSize: big ? 22 : 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
      {right}
    </div>
  );
}

/* ------------------------------------------------------------------- NavBar */
function NavBar({ role = 'athlete', active }) {
  const items = role === 'coach'
    ? [['Accueil', Icon.home], ['Athlètes', Icon.users], ['En direct', Icon.live], ['Programmes', Icon.clipboard], ['Profil', Icon.user]]
    : [['Accueil', Icon.home], ['Programme', Icon.calendar], ['Progression', Icon.chart], ['Profil', Icon.user]];
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 78, paddingBottom: 18,
      background: 'color-mix(in oklch, var(--bg) 86%, transparent)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
      {items.map(([label, I]) => {
        const on = label === active;
        return (
          <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: on ? 'var(--accent)' : 'var(--text-muted)' }}>
            <I width={role === 'coach' ? 22 : 24} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.01em' }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------- Password strength */
function StrengthMeter({ level = 0 }) { // 0..4
  const colors = ['var(--border)', 'var(--error)', 'var(--warning)', 'var(--warning)', 'var(--success)'];
  const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 999,
            background: i <= level ? colors[level] : 'var(--surface2)' }} />
        ))}
      </div>
      {level > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: colors[level] }}>{labels[level]}</span>}
    </div>
  );
}

/* ----------------------------------------------------------- Settings rows */
function SettingsRow({ icon, label, value, trailing, danger = false, last = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52, padding: '0 14px',
      borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      {icon && <span style={{ color: danger ? 'var(--error)' : 'var(--text-sub)', display: 'flex' }}>{icon}</span>}
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: danger ? 'var(--error)' : 'var(--text)' }}>{label}</span>
      {value && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-sub)' }}>{value}</span>}
      {trailing !== undefined ? trailing : <span style={{ color: 'var(--text-muted)', display: 'flex' }}><Icon.chevron /></span>}
    </div>
  );
}
function SettingsGroup({ children, style = {} }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)', overflow: 'hidden', ...style }}>{children}</div>;
}

/* ----------------------------------------------------------- Divider w/ text */
function OrDivider({ text = 'ou' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

/* ------------------------------------------------------------------- Avatar */
function Avatar({ initials = 'FL', size = 56, ring = false }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flex: '0 0 auto',
      background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontWeight: 700, fontSize: size * 0.34, letterSpacing: '-0.01em',
      border: ring ? '2px solid var(--accent)' : '1px solid var(--border)' }}>{initials}</div>
  );
}

Object.assign(window, {
  Screen, StatusBar, Icon, Logo, Btn, Field, Pill, Card, LinearProgress, Toggle,
  SectionLabel, TopBar, NavBar, StrengthMeter, SettingsRow, SettingsGroup, OrDivider, Avatar, PX,
});
