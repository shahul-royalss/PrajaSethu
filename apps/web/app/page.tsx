'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from './lib/intl';
import { api } from './lib/api';
import {
  CitizenUser,
  Officer,
  getCitizen,
  getCitizenToken,
  getOfficer,
  getToken,
  saveCitizenSession,
  saveSession,
} from './lib/session';

type Mode = 'citizen' | 'staff';
type Step = 'phone' | 'otp';

const DEMO_STAFF = ['cs.officer', 'rws.officer', 'mpdo', 'collector', 'auditor'];

export default function LoginPage() {
  const { lang, setLang } = useI18n();
  const router = useRouter();
  const te = lang === 'te';
  const bi = (en: string, teStr: string) => (te ? teStr : en);

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>('citizen');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // Already signed in? Go straight to the right home.
    if (getCitizenToken() && getCitizen()) { router.replace('/citizen'); return; }
    if (getToken() && getOfficer()) { router.replace('/staff'); return; }
    setReady(true);
    api.warm(); // start a sleeping API's cold start now, so submit is instant later
  }, [router]);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2800); }

  if (!ready) return <div className="auth-page" style={{ minHeight: '100vh' }} />;

  return (
    <div className={`auth-page${te ? ' te' : ''}`}>
      <AuthSprite />
      <div className="auth">
        {/* ===== BRAND PANEL ===== */}
        <aside className="brand-panel">
          <div className="glow" />
          <svg className="motif" viewBox="0 0 200 200" fill="none" stroke="#CBA046" strokeWidth="0.7" opacity="0.9" aria-hidden>
            <circle cx="100" cy="100" r="92" strokeOpacity=".35" />
            <circle cx="100" cy="100" r="74" strokeOpacity=".25" />
            <circle cx="100" cy="100" r="40" strokeOpacity=".5" />
            <circle cx="100" cy="100" r="6" fill="#CBA046" stroke="none" fillOpacity=".6" />
            <g strokeOpacity=".4">
              <line x1="100" y1="8" x2="100" y2="192" /><line x1="8" y1="100" x2="192" y2="100" />
              <line x1="35" y1="35" x2="165" y2="165" /><line x1="165" y1="35" x2="35" y2="165" />
            </g>
            <polygon points="100,40 108,100 100,96 92,100" fill="#CBA046" stroke="none" fillOpacity=".55" />
          </svg>

          <div className="bp-top">
            <div className="bmark"><I n="compass" /></div>
            <div>
              <div className="bp-name">SAARTHI</div>
              <div className="bp-sub">{bi('Grievance Console', 'ఫిర్యాదు కన్సోల్')}</div>
            </div>
          </div>

          <div className="bp-mid">
            <div className="bp-tagline">
              {te
                ? <>ఒకే గొంతు. <span className="gold">ప్రతి భాష.</span> ప్రతి పౌరుడు.</>
                : <>One voice. <span className="gold">Every language.</span> Every citizen.</>}
            </div>
            <div className="bp-mode">
              {mode === 'citizen'
                ? bi('Speak your problem in your own language — Saarthi asks simple questions and does the paperwork for you.', 'మీ సమస్యను మీ భాషలో చెప్పండి — సారథి సరళమైన ప్రశ్నలు అడిగి, పేపర్‌వర్క్ మీ కోసం చేస్తుంది.')
                : bi('A calm command console for the officers who serve — every case pre-read, routed and notarised.', 'సేవ చేసే అధికారుల కోసం ప్రశాంత కమాండ్ కన్సోల్ — ప్రతి కేసు ముందే చదవబడి, రూట్ చేయబడి, నోటరైజ్ చేయబడుతుంది.')}
            </div>
          </div>

          <div className="bp-feats">
            <Feat icon="globe" t={bi('12 Indian languages, voice-first', '12 భారతీయ భాషలు, వాయిస్-ఫస్ట్')} d={bi('No forms. Just talk, in Telugu or any language.', 'ఫారాలు లేవు. తెలుగులో లేదా ఏ భాషలోనైనా మాట్లాడండి.')} />
            <Feat icon="shield" t={bi('Secure & consent-based', 'సురక్షితం & సమ్మతి-ఆధారిత')} d={bi("We use only what's needed to resolve your case.", 'మీ కేసు పరిష్కారానికి అవసరమైనది మాత్రమే వాడతాం.')} />
            <Feat icon="ledger" t={bi('Tamper-evident ledger', 'ట్యాంపర్-ఎవిడెంట్ లెడ్జర్')} d={bi('Every action recorded and verifiable.', 'ప్రతి చర్య నమోదు చేయబడి, ధృవీకరించదగినది.')} />
          </div>

          <div className="bp-foot">
            <div className="emblem"><I n="landmark" /></div>
            <div>
              <div className="gt">{bi('Government of India', 'భారత ప్రభుత్వం')}</div>
              <div className="gs">{bi('Real-Time Governance · Public Grievance Redressal', 'రియల్-టైమ్ గవర్నెన్స్ · ప్రజా ఫిర్యాదుల పరిష్కారం')}</div>
            </div>
          </div>
        </aside>

        {/* ===== AUTH PANEL ===== */}
        <main className="auth-panel">
          <div className="ap-top">
            <div className="lang" role="group" aria-label="Language">
              <button className={te ? '' : 'on'} aria-pressed={!te} onClick={() => setLang('en')}>EN</button>
              <button className={te ? 'on' : ''} aria-pressed={te} lang="te" onClick={() => setLang('te')} style={{ fontFamily: "'Noto Sans Telugu',sans-serif" }}>తెలుగు</button>
            </div>
          </div>

          <div className="ap-body">
            <div className="formwrap">
              <div className="seg" role="tablist" aria-label="Sign in as">
                <button className={mode === 'citizen' ? 'on' : ''} role="tab" aria-selected={mode === 'citizen'} onClick={() => setMode('citizen')}><I n="user" /><span>{bi('Citizen', 'పౌరుడు')}</span></button>
                <button className={mode === 'staff' ? 'on' : ''} role="tab" aria-selected={mode === 'staff'} onClick={() => setMode('staff')}><I n="badge" /><span>{bi('Officer / Staff', 'అధికారి / సిబ్బంది')}</span></button>
              </div>

              {mode === 'citizen'
                ? <CitizenForm bi={bi} router={router} flash={flash} />
                : <StaffForm bi={bi} router={router} flash={flash} />}
            </div>
          </div>

          <div className="ap-foot">
            {bi('SAARTHI · Public Grievance Redressal Platform', 'సారథి · ప్రజా ఫిర్యాదుల పరిష్కార వేదిక')} · {bi('Government of India', 'భారత ప్రభుత్వం')}
          </div>
        </main>
      </div>

      {toast && <Toast msg={toast} />}
    </div>
  );
}

// ── Citizen (mobile → OTP) ───────────────────────────────────────────────────
function CitizenForm({ bi, router, flash }: { bi: (e: string, t: string) => string; router: ReturnType<typeof useRouter>; flash: (m: string) => void }) {
  const [step, setStep] = useState<Step>('phone');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true); setError(null);
    const wt = setTimeout(() => setWaking(true), 1500);
    try { return await fn(); }
    catch (e) { setError((e as Error).message); return null; }
    finally { clearTimeout(wt); setWaking(false); setBusy(false); }
  }

  async function sendOtp() {
    const r = await run(() => api.postSafe<{ devCode?: string }>('/auth/citizen/request-otp', { mobile }));
    if (!r) return;
    setDevCode(r.devCode ?? null);
    setOtp(r.devCode ?? '');
    setStep('otp');
  }
  async function verify() {
    const r = await run(() => api.postSafe<{ accessToken: string; citizen: CitizenUser }>('/auth/citizen/verify-otp', { mobile, code: otp }));
    if (!r) return;
    saveCitizenSession(r.accessToken, r.citizen);
    router.push('/citizen');
  }

  const masked = mobile.length >= 4 ? `+91 ●●●●● ●${mobile.slice(-3)}` : '+91 •••••';

  if (step === 'otp') {
    return (
      <div>
        <div className="f-head"><h1>{bi('Enter the code', 'కోడ్ నమోదు చేయండి')}</h1></div>
        <div className="otp-sent"><I n="check" style={{ width: 15, height: 15, color: 'var(--ok)' }} /><span>{bi('OTP sent to', 'OTP పంపబడింది')}</span> <b>{masked}</b></div>
        {devCode && <div className="demo-otp">🧪 {bi('Demo mode (no SMS sent) — your code is', 'డెమో మోడ్ (SMS లేదు) — మీ కోడ్')} <b>{devCode}</b>, {bi('already filled in. Just tap Verify.', 'ఇప్పటికే నింపబడింది. ధృవీకరించండి.')}</div>}
        <OtpBoxes value={otp} onChange={setOtp} onComplete={verify} />
        {error && <ErrLine msg={error} />}
        {waking && <Waking bi={bi} />}
        <button className="btn btn-gold" disabled={busy || otp.length < 6} onClick={verify}><I n="check" /><span>{busy ? bi('Verifying…', 'ధృవీకరిస్తోంది…') : bi('Verify & continue', 'ధృవీకరించి కొనసాగండి')}</span></button>
        <div className="otp-actions">
          <button className="muted-btn" onClick={() => { setStep('phone'); setOtp(''); setError(null); }}>{bi('Change number', 'నంబర్ మార్చండి')}</button>
          <button className="linkbtn" onClick={sendOtp}>{bi('Resend code', 'కోడ్ మళ్ళీ పంపండి')}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="f-head">
        <h1>{bi('Raise or track a grievance', 'ఫిర్యాదు చేయండి లేదా ట్రాక్ చేయండి')}</h1>
        <p>{bi("Sign in with your mobile number — we'll send a one-time code.", 'మీ మొబైల్ నంబర్‌తో సైన్ ఇన్ చేయండి — మేము వన్-టైమ్ కోడ్ పంపుతాం.')}</p>
      </div>
      <div className="field">
        <label htmlFor="phone">{bi('Mobile number', 'మొబైల్ నంబర్')}</label>
        <div className="inp lg">
          <span className="pre">+91</span>
          <input id="phone" type="tel" inputMode="numeric" maxLength={10} placeholder="98765 43210" autoComplete="tel"
            value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
            onKeyDown={(e) => e.key === 'Enter' && mobile.length === 10 && sendOtp()} />
        </div>
      </div>
      {error && <ErrLine msg={error} />}
      {waking && <Waking bi={bi} />}
      <button className="btn btn-primary" disabled={busy || mobile.length < 10} onClick={sendOtp}><span>{busy ? bi('Connecting…', 'కనెక్ట్ అవుతోంది…') : bi('Send OTP', 'OTP పంపండి')}</span><I n="arrow" /></button>

      <div className="divider"><span>{bi('or', 'లేదా')}</span></div>
      <button className="btn-out" onClick={() => flash(bi('Aadhaar / DigiLocker sign-in arrives in a later phase of the pilot.', 'ఆధార్ / డిజిలాకర్ సైన్-ఇన్ తర్వాతి దశలో వస్తుంది.'))}><I n="fingerprint" /><span>{bi('Use Aadhaar / DigiLocker', 'ఆధార్ / డిజిలాకర్ వాడండి')}</span></button>

      <button className="voice-call" onClick={() => router.push('/citizen/new')}>
        <div className="voice-ic"><I n="mic" /></div>
        <div>
          <div className="vt">{bi("Can't type? File by voice", 'టైప్ చేయలేరా? వాయిస్ ద్వారా చెప్పండి')}</div>
          <div className="vd">{bi('Saarthi will ask you simple questions and fill the rest.', 'సారథి సరళమైన ప్రశ్నలు అడిగి, మిగతాది నింపుతుంది.')}</div>
        </div>
        <span className="go"><I n="arrow" /></span>
      </button>

      <div className="help-line"><I n="help" /><span>{bi('Need help? Visit your Grama/Ward Sachivalayam or call ', 'సహాయం కావాలా? మీ గ్రామ/వార్డు సచివాలయాన్ని సందర్శించండి లేదా కాల్ చేయండి ')}</span><b className="mono">1902</b></div>
      <div className="consent"><I n="check" /><span>{bi('By continuing, you agree to share only the details needed to resolve your grievance. Your data is protected and consent-based.', 'కొనసాగించడం ద్వారా, మీ ఫిర్యాదు పరిష్కారానికి అవసరమైన వివరాలను మాత్రమే పంచుకోవడానికి మీరు అంగీకరిస్తున్నారు. మీ డేటా రక్షించబడుతుంది.')}</span></div>
    </div>
  );
}

// ── Staff (username / password) ──────────────────────────────────────────────
function StaffForm({ bi, router, flash }: { bi: (e: string, t: string) => string; router: ReturnType<typeof useRouter>; flash: (m: string) => void }) {
  const [user, setUser] = useState('');
  const [pwd, setPwd] = useState('Praja@123');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true); setError(null);
    const wt = setTimeout(() => setWaking(true), 1500);
    try {
      const r = await api.postSafe<{ accessToken: string; officer: Officer }>('/auth/officer/login', { username: user, password: pwd });
      saveSession(r.accessToken, r.officer);
      router.push('/staff');
    } catch (e) { setError((e as Error).message); }
    finally { clearTimeout(wt); setWaking(false); setBusy(false); }
  }

  return (
    <div>
      <div className="f-head">
        <h1>{bi('Officer & staff sign-in', 'అధికారి & సిబ్బంది సైన్-ఇన్')}</h1>
        <p>{bi('For Collectors, department officers and Sachivalayam staff.', 'కలెక్టర్లు, శాఖ అధికారులు మరియు సచివాలయ సిబ్బంది కోసం.')}</p>
      </div>
      <div className="field">
        <label htmlFor="empid">{bi('Work account · username or government email', 'వర్క్ ఖాతా · యూజర్‌నేమ్ లేదా ప్రభుత్వ ఇమెయిల్')}</label>
        <div className="inp">
          <span className="ic"><I n="mail" /></span>
          <input id="empid" type="text" placeholder="cs.officer / name@ap.gov.in" autoComplete="username"
            value={user} onChange={(e) => setUser(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && user && signIn()} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="pwd">{bi('Password', 'పాస్‌వర్డ్')}</label>
        <div className="inp">
          <span className="ic"><I n="lock" /></span>
          <input id="pwd" type={show ? 'text' : 'password'} placeholder="••••••••••" autoComplete="current-password"
            value={pwd} onChange={(e) => setPwd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && user && signIn()} />
          <button className="eye" type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)}><I n={show ? 'eye-off' : 'eye'} /></button>
        </div>
      </div>
      <div className="row-between">
        <label className="check"><input type="checkbox" defaultChecked /><span>{bi('Remember this device', 'ఈ పరికరాన్ని గుర్తుంచుకో')}</span></label>
        <a href="#" onClick={(e) => { e.preventDefault(); flash(bi('Contact your department admin to reset access.', 'యాక్సెస్ రీసెట్ కోసం మీ అడ్మిన్‌ను సంప్రదించండి.')); }}>{bi('Forgot password?', 'పాస్‌వర్డ్ మర్చిపోయారా?')}</a>
      </div>
      {error && <ErrLine msg={error} />}
      {waking && <Waking bi={bi} />}
      <button className="btn btn-primary" disabled={busy || !user} onClick={signIn}><I n="lock" /><span>{busy ? bi('Signing in…', 'సైన్ ఇన్ అవుతోంది…') : bi('Sign in securely', 'సురక్షితంగా సైన్ ఇన్ చేయండి')}</span></button>

      <div className="divider"><span>{bi('or', 'లేదా')}</span></div>
      <button className="btn-out" onClick={() => flash(bi('AP Government SSO arrives in a later phase of the pilot.', 'AP ప్రభుత్వ SSO తర్వాతి దశలో వస్తుంది.'))}><I n="key" /><span>{bi('Sign in with Government SSO', 'ప్రభుత్వ SSOతో సైన్ ఇన్ చేయండి')}</span></button>

      <div className="demo">
        <div className="dl">{bi('Demo accounts · password Praja@123', 'డెమో ఖాతాలు · పాస్‌వర్డ్ Praja@123')}</div>
        <div className="chips">
          {DEMO_STAFF.map((u) => <button key={u} onClick={() => { setUser(u); setPwd('Praja@123'); }}>{u}</button>)}
        </div>
      </div>

      <div className="sec-note">
        <I n="shield" />
        <span>{bi('Secured with multi-factor authentication. Authorised access only — this is a Government of India system and all activity is monitored and recorded on the audit ledger.', 'బహుళ-కారక ప్రామాణీకరణతో సురక్షితం. అధీకృత యాక్సెస్ మాత్రమే — ఇది భారత ప్రభుత్వ వ్యవస్థ; మొత్తం కార్యకలాపం ఆడిట్ లెడ్జర్‌లో నమోదు చేయబడుతుంది.')}</span>
      </div>
    </div>
  );
}

// ── small pieces ─────────────────────────────────────────────────────────────
function OtpBoxes({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete: () => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  function setAt(i: number, c: string) {
    const next = (value.slice(0, i) + c + value.slice(i + 1)).slice(0, 6);
    onChange(next);
    if (c && i < 5) refs.current[i + 1]?.focus();
    if (next.length === 6 && !next.includes(undefined as any) && next.replace(/\s/g, '').length === 6) {
      // all filled
    }
  }
  return (
    <div className="otp-boxes">
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          value={c}
          onChange={(e) => setAt(i, e.target.value.replace(/\D/g, '').slice(0, 1))}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !chars[i] && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'Enter' && value.length === 6) onComplete();
          }}
          onPaste={(e) => {
            const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (p) { e.preventDefault(); onChange(p); refs.current[Math.min(p.length, 5)]?.focus(); }
          }}
        />
      ))}
    </div>
  );
}

function ErrLine({ msg }: { msg: string }) {
  return <div className="errline"><I n="info" />{msg}</div>;
}
function Waking({ bi }: { bi: (e: string, t: string) => string }) {
  return <div className="waking"><span className="spin" />{bi('Waking up the secure server — first use can take up to a minute.', 'సురక్షిత సర్వర్ మేల్కొంటోంది — మొదటిసారి ఒక నిమిషం పట్టవచ్చు.')}</div>;
}
function Feat({ icon, t, d }: { icon: IconName; t: string; d: string }) {
  return (
    <div className="feat">
      <div className="feat-ic"><I n={icon} /></div>
      <div><div className="t">{t}</div><div className="d">{d}</div></div>
    </div>
  );
}
function Toast({ msg }: { msg: string }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#0D2150', color: '#fff', padding: '13px 20px', borderRadius: 12, fontSize: 13.5, fontWeight: 600, boxShadow: '0 18px 48px rgba(9,22,51,.20)', display: 'flex', alignItems: 'center', gap: 10, zIndex: 50 }}>
      <I n="sparkle" style={{ width: 17, height: 17, color: '#CBA046' }} />{msg}
    </div>
  );
}

// ── icons ────────────────────────────────────────────────────────────────────
type IconName =
  | 'compass' | 'globe' | 'shield' | 'ledger' | 'landmark' | 'user' | 'badge' | 'phone'
  | 'mail' | 'lock' | 'eye' | 'eye-off' | 'mic' | 'fingerprint' | 'key' | 'arrow'
  | 'check' | 'info' | 'help' | 'sparkle';

function I({ n, style }: { n: IconName; style?: React.CSSProperties }) {
  return <svg style={style} aria-hidden="true"><use href={`#a-${n}`} /></svg>;
}

function AuthSprite() {
  return (
    <svg style={{ display: 'none' }} aria-hidden="true">
      <symbol id="a-compass" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polygon points="15.5 8.5 11 11 8.5 15.5 13 13" /></symbol>
      <symbol id="a-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" /></symbol>
      <symbol id="a-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></symbol>
      <symbol id="a-ledger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="13" y2="16" /></symbol>
      <symbol id="a-landmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22" /><line x1="4" y1="10" x2="4" y2="18" /><line x1="9" y1="10" x2="9" y2="18" /><line x1="15" y1="10" x2="15" y2="18" /><line x1="20" y1="10" x2="20" y2="18" /><polygon points="12 2 20 7 4 7 12 2" /></symbol>
      <symbol id="a-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></symbol>
      <symbol id="a-badge" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2.4" /><path d="M5.5 17a3.5 3.5 0 0 1 7 0" /><line x1="15" y1="9" x2="18.5" y2="9" /><line x1="15" y1="13" x2="18.5" y2="13" /></symbol>
      <symbol id="a-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></symbol>
      <symbol id="a-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></symbol>
      <symbol id="a-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></symbol>
      <symbol id="a-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></symbol>
      <symbol id="a-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.9 17.9A10.6 10.6 0 0 1 12 20C5 20 1 12 1 12a19.5 19.5 0 0 1 5.1-5.9M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a19.4 19.4 0 0 1-2.2 3.2M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2" /></symbol>
      <symbol id="a-mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="22" /></symbol>
      <symbol id="a-fingerprint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10a2 2 0 0 0-2 2c0 1.5 0 3-.5 4.5" /><path d="M5 13.3a7 7 0 0 1 14-1.3v1a18 18 0 0 1-.5 4" /><path d="M8 16a10 10 0 0 0 .5-5 3.5 3.5 0 0 1 7-.5" /><path d="M2.5 10a10 10 0 0 1 19 0" /><path d="M12 19c0 1 0 1.5-.3 2.5" /></symbol>
      <symbol id="a-key" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.3-9.3" /><path d="m16 5 3 3" /><path d="m20 7 1.5-1.5" /></symbol>
      <symbol id="a-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></symbol>
      <symbol id="a-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></symbol>
      <symbol id="a-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" /></symbol>
      <symbol id="a-help" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></symbol>
      <symbol id="a-sparkle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" /></symbol>
    </svg>
  );
}
