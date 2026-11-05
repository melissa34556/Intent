import { useEffect, useMemo, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { AlarmClock, ArrowRight, Check, Clock3, Pause, Play, Plus, Timer, X } from 'lucide-react';

const PRESETS = [10, 20, 30];
const InstalledApps = registerPlugin('InstalledApps');

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? [hours, minutes, secs].map((n) => String(n).padStart(2, '0')).join(':')
    : [minutes, secs].map((n) => String(n).padStart(2, '0')).join(':');
}

function readSessions() {
  try {
    return JSON.parse(localStorage.getItem('intent-sessions') || '[]');
  } catch {
    return [];
  }
}

export default function App() {
  const [mode, setMode] = useState('duration');
  const [minutes, setMinutes] = useState('20');
  const [endAt, setEndAt] = useState('20:00');
  const [targetTime, setTargetTime] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState('');
  const [sessions, setSessions] = useState(readSessions);
  const [startedAt, setStartedAt] = useState(null);
  const [warned, setWarned] = useState([]);
  const [apps, setApps] = useState(() => {
    try { return JSON.parse(localStorage.getItem('intent-apps') || '[]'); }
    catch { return []; }
  });
  const [availableApps, setAvailableApps] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appError, setAppError] = useState('');

  useEffect(() => {
    if (!running || paused) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setRemaining(next);
      if (next === 300 && !warned.includes(300)) {
        setNotice('Nog 5 minuten. Rond rustig af wanneer je zover bent.');
        setWarned((old) => [...old, 300]);
      } else if (next === 120 && !warned.includes(120)) {
        setNotice('Nog 2 minuten. Houd je eindtijd in de gaten.');
        setWarned((old) => [...old, 120]);
      } else if (next === 0) {
        setRunning(false);
        setPaused(false);
        setNotice('Je ingestelde tijd is voorbij.');
        finishSession();
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [running, paused, targetTime, warned]);

  async function openAppPicker() {
    setPickerOpen(true);
    setAppError('');
    if (!Capacitor.isNativePlatform()) {
      setAvailableApps([]);
      return;
    }
    setLoadingApps(true);
    try {
      const result = await InstalledApps.getInstalledApps();
      setAvailableApps(result.apps || []);
    } catch (error) {
      setAppError('De apps op je telefoon konden niet worden opgehaald. Probeer het opnieuw.');
    } finally {
      setLoadingApps(false);
    }
  }

  function addApp(app) {
    setApps((current) => {
      if (current.some((item) => item.packageName === app.packageName)) return current;
      const updated = [...current, app];
      localStorage.setItem('intent-apps', JSON.stringify(updated));
      return updated;
    });
    setPickerOpen(false);
  }

  function removeApp(packageName) {
    setApps((current) => {
      const updated = current.filter((item) => item.packageName !== packageName);
      localStorage.setItem('intent-apps', JSON.stringify(updated));
      return updated;
    });
  }

  async function launchApp(app) {
    if (!Capacitor.isNativePlatform()) {
      setNotice('Apps openen kan vanuit de geïnstalleerde Android-app van Intent.');
      return;
    }
    try {
      await InstalledApps.launchApp({ packageName: app.packageName });
    } catch (error) {
      setNotice('Deze app kon niet worden geopend.');
    }
  }

  function finishSession() {
    if (!startedAt) return;
    const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    const entry = { id: Date.now(), date: new Date().toISOString(), minutes: elapsed };
    setSessions((old) => {
      const updated = [entry, ...old].slice(0, 100);
      localStorage.setItem('intent-sessions', JSON.stringify(updated));
      return updated;
    });
    setStartedAt(null);
  }

  const todayMinutes = useMemo(() => {
    const today = new Date().toDateString();
    return sessions
      .filter((item) => new Date(item.date).toDateString() === today)
      .reduce((sum, item) => sum + item.minutes, 0);
  }, [sessions]);

  function getDurationSeconds() {
    if (mode === 'duration') {
      const value = Number(minutes);
      if (!Number.isFinite(value) || value <= 0) return 0;
      return Math.round(value * 60);
    }
    const [h, m] = endAt.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
    const now = new Date();
    const end = new Date(now);
    end.setHours(h, m, 0, 0);
    if (end <= now) end.setDate(end.getDate() + 1);
    return Math.floor((end.getTime() - now.getTime()) / 1000);
  }

  function startTimer() {
    const seconds = getDurationSeconds();
    if (!seconds) {
      setNotice('Kies eerst een geldige tijd.');
      return;
    }
    setTotal(seconds);
    setRemaining(seconds);
    setTargetTime(Date.now() + seconds * 1000);
    setStartedAt(Date.now());
    setWarned([]);
    setNotice('');
    setRunning(true);
    setPaused(false);
  }

  function pauseTimer() {
    setPaused(true);
    setTargetTime(Date.now() + remaining * 1000);
  }

  function resumeTimer() {
    setTargetTime(Date.now() + remaining * 1000);
    setPaused(false);
  }

  function stopTimer() {
    setRunning(false);
    setPaused(false);
    setRemaining(0);
    setNotice('Sessie gestopt.');
    setStartedAt(null);
    setTargetTime(null);
  }

  const progress = total > 0 ? Math.max(0, Math.min(100, ((total - remaining) / total) * 100)) : 0;
  const active = running;
  const recentSessions = sessions.slice(0, 5);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">i</div>
        <div>
          <div className="brand-name">intent</div>
          <div className="brand-subtitle">Maak bewust ruimte voor je tijd.</div>
        </div>
      </header>

      <section className="apps-section">
        <div className="apps-heading">
          <div>
            <p className="eyebrow">JOUW PLEK</p>
            <h1>Mijn apps</h1>
          </div>
        </div>
        <div className="app-grid">
          {Array.from({ length: Math.max(6, apps.length + 1) }, (_, index) => {
            const app = apps[index];
            if (app) {
              return (
                <div className="app-slot" key={app.packageName}>
                  <button className="app-tile" onClick={() => launchApp(app)} aria-label={app.name + ' openen'}>
                    <span className="app-icon-frame"><img src={app.icon} alt="" /></span>
                    <span className="app-label">{app.name}</span>
                  </button>
                  <button className="remove-app" onClick={() => removeApp(app.packageName)} aria-label={app.name + ' verwijderen'}><X size={12} /></button>
                </div>
              );
            }
            return (
              <button
                className={index === apps.length ? 'app-tile empty-app-tile add-app-tile' : 'app-tile empty-app-tile'}
                key={'empty-' + index}
                onClick={index === apps.length ? openAppPicker : undefined}
                disabled={index !== apps.length}
                aria-label={index === apps.length ? 'App toevoegen' : 'Leeg app-vak'}
              >
                <span className="empty-app-icon">{index === apps.length ? <Plus size={21} strokeWidth={1.7} /> : null}</span>
                <span className="app-label empty-label">{index === apps.length ? 'Toevoegen' : ' '}</span>
              </button>
            );
          })}
        </div>
        {pickerOpen && (
          <div className="app-picker-backdrop" onClick={() => setPickerOpen(false)}>
            <section className="app-picker" role="dialog" aria-modal="true" aria-label="App kiezen" onClick={(event) => event.stopPropagation()}>
              <div className="picker-heading">
                <div><h2>App toevoegen</h2><p>Kies een app die op je telefoon staat.</p></div>
                <button className="picker-close" onClick={() => setPickerOpen(false)} aria-label="Sluiten"><X size={19} /></button>
              </div>
              {!Capacitor.isNativePlatform() ? (
                <p className="picker-message">Het kiezen van geïnstalleerde apps is beschikbaar in de Android-app van Intent. Open Intent op je telefoon om apps toe te voegen.</p>
              ) : loadingApps ? (
                <p className="picker-message">Geïnstalleerde apps ophalen…</p>
              ) : appError ? (
                <p className="picker-message">{appError}</p>
              ) : availableApps.filter((item) => !apps.some((selected) => selected.packageName === item.packageName)).length ? (
                <div className="available-app-list">
                  {availableApps.filter((item) => !apps.some((selected) => selected.packageName === item.packageName)).map((app) => (
                    <button className="available-app" key={app.packageName} onClick={() => addApp(app)}>
                      <img src={app.icon} alt="" />
                      <span>{app.name}</span>
                      <Plus size={17} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="picker-message">Alle gevonden apps zijn al toegevoegd.</p>
              )}
            </section>
          </div>
        )}
      </section>

      <section className="timer-card">
        <div className="card-heading">
          <div className="heading-icon"><Timer size={18} /></div>
          <div>
            <h2>Stel je tijd in</h2>
            <p>Jij bepaalt hoe lang je neemt.</p>
          </div>
        </div>

        {!active ? (
          <>
            <div className="mode-switch" role="tablist" aria-label="Manier van instellen">
              <button className={mode === 'duration' ? 'selected' : ''} onClick={() => setMode('duration')} role="tab" aria-selected={mode === 'duration'}>Aantal minuten</button>
              <button className={mode === 'end' ? 'selected' : ''} onClick={() => setMode('end')} role="tab" aria-selected={mode === 'end'}>Eindtijd</button>
            </div>

            {mode === 'duration' ? (
              <div className="duration-area">
                <div className="preset-row">
                  {PRESETS.map((value) => (
                    <button key={value} className={Number(minutes) === value ? 'preset active-preset' : 'preset'} onClick={() => setMinutes(String(value))}>{value} min</button>
                  ))}
                </div>
                <label className="field-label" htmlFor="custom-minutes">Of kies zelf je tijd</label>
                <div className="number-field">
                  <input id="custom-minutes" type="number" min="1" max="1440" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
                  <span>minuten</span>
                </div>
              </div>
            ) : (
              <div className="duration-area">
                <label className="field-label" htmlFor="end-time">Wanneer wil je klaar zijn?</label>
                <div className="number-field time-field">
                  <input id="end-time" type="time" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
                  <span><AlarmClock size={17} /> eindtijd</span>
                </div>
                <p className="field-hint">Als de gekozen tijd vandaag al voorbij is, wordt morgen bedoeld.</p>
              </div>
            )}

            <button className="start-button" onClick={startTimer}><Play size={17} fill="currentColor" /> Start mijn tijd <ArrowRight size={17} /></button>
          </>
        ) : (
          <div className="active-timer">
            <div className="timer-caption">{paused ? 'Even gepauzeerd' : 'Jouw tijd loopt'}</div>
            <div className="time-display">{formatTime(remaining)}</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: progress + '%' }} /></div>
            <div className="timer-actions">
              {paused ? <button className="start-button compact" onClick={resumeTimer}><Play size={16} /> Hervatten</button> : <button className="secondary-button" onClick={pauseTimer}><Pause size={16} /> Pauzeren</button>}
              <button className="stop-button" onClick={stopTimer}><X size={16} /> Stoppen</button>
            </div>
          </div>
        )}
        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Melding sluiten"><X size={15} /></button></div>}
        <div className="reminder-note"><Clock3 size={15} /><span>Je krijgt een seintje bij 5 en 2 minuten resterend, zolang Intent geopend is.</span></div>
      </section>

      <section className="stats-row">
        <div className="stat-card">
          <span className="stat-label">VANDAAG BEWUSTE TIJD</span>
          <strong>{todayMinutes}<small> min</small></strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">SESSIES OPGESLAGEN</span>
          <strong>{sessions.length}</strong>
        </div>
      </section>

      <section className="recent-card">
        <div className="recent-heading"><div><h2>Recente momenten</h2><p>Een klein overzicht van je sessies.</p></div><Check size={18} /></div>
        {recentSessions.length ? (
          <ul className="session-list">
            {recentSessions.map((item) => (
              <li key={item.id}>
                <span className="session-dot" />
                <span>{new Date(item.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
                <strong>{item.minutes} min</strong>
              </li>
            ))}
          </ul>
        ) : <p className="empty-state">Je eerste sessie verschijnt hier.</p>}
      </section>

      <footer>Intent · jouw tijd, jouw keuze</footer>
    </main>
  );
}