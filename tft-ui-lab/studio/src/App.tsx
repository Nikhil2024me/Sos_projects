import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutDoc, ScreenSpec, WidgetSpec } from '@shared/lib/layout-engine';
import { initialLayout, engine, icons, meta, scenarios, theme } from './data';
import { issueCounts, lintLayout, sceneFor, type LintIssue } from './lib/lint';
import ScreenPreview from './components/ScreenPreview';
import ScreenThumb from './components/ScreenThumb';
import Inspector from './components/Inspector';
import IssuePanel from './components/IssuePanel';
import CodePanel from './components/CodePanel';
import DevicePanel from './components/DevicePanel';

type Tab = 'inspect' | 'issues' | 'code' | 'device';
type ScenarioKey = 'default' | 'max' | string;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function defaultWidget(screenId: string, type: string, index: number): WidgetSpec {
  const id = `${screenId}.${type}${index}`;
  switch (type) {
    case 'button':
      return { id, type, x: 16, y: 180, w: 140, h: 36, label: 'NEW BUTTON', variant: 'secondary', font: 'label', icon: 'play' };
    case 'panel':
      return { id, type, x: 16, y: 130, w: 160, h: 48, style: 'card', radius: 6 };
    case 'icon':
      return { id, type, x: 16, y: 90, w: 24, h: 24, icon: 'chip', size: 24, color: 'accent' };
    case 'progress':
      return { id, type, x: 16, y: 120, w: 200, h: 10, segments: 32 };
    case 'statCard':
      return { id, type, x: 16, y: 80, w: 120, h: 62, label: 'VALUE', value: '0', icon: 'gauge', tone: 'accent' };
    default:
      return { id, type: 'text', x: 16, y: 70, w: 180, h: 18, text: 'NEW LABEL', font: 'body', color: 'text', align: 'left', valign: 'middle' };
  }
}

export default function App() {
  const [layout, setLayout] = useState<LayoutDoc>(() => clone(initialLayout));
  const [screenId, setScreenId] = useState('home');
  const [selectedId, setSelectedId] = useState<string | null>('home.run');
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>('default');
  const [tab, setTab] = useState<Tab>('inspect');
  const [mode, setMode] = useState<'edit' | 'touch'>('edit');
  const [zoom, setZoom] = useState(2);
  const [showGrid, setShowGrid] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState('');
  const [toast, setToast] = useState('');

  const screen = layout.screens.find((s) => s.id === screenId) ?? layout.screens[0];
  const activeScenario =
    scenarioKey === 'default' || scenarioKey === 'max'
      ? null
      : scenarios.scenarios.find((s) => s.id === scenarioKey) ?? null;
  const scenarioLabel =
    scenarioKey === 'default' ? 'Default data' : scenarioKey === 'max' ? 'Worst-case text' : activeScenario?.label ?? 'Default';
  const scene = useMemo(
    () => sceneFor(screen.id, activeScenario, scenarios, scenarioKey === 'max'),
    [screen.id, activeScenario, scenarioKey]
  );
  const laid = useMemo(() => engine.layoutScreen(screen, scene), [screen, scene]);
  const issues = useMemo(() => lintLayout(layout, engine, theme, icons, scenarios), [layout]);
  const counts = issueCounts(issues);
  const selected = screen.widgets.find((w) => w.id === selectedId) ?? null;
  const screenIssues = issues.filter((i) => i.screen === screen.id);

  const markChanged = () => {
    setDirty(true);
    setSaveState('');
  };

  const updateWidget = (id: string, patch: Partial<WidgetSpec>) => {
    setLayout((prev) => ({
      ...prev,
      screens: prev.screens.map((s) =>
        s.id !== screen.id ? s : { ...s, widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)) }
      ),
    }));
    markChanged();
  };

  const deleteWidget = (id: string) => {
    setLayout((prev) => ({
      ...prev,
      screens: prev.screens.map((s) => (s.id !== screen.id ? s : { ...s, widgets: s.widgets.filter((w) => w.id !== id) })),
    }));
    if (selectedId === id) setSelectedId(null);
    markChanged();
  };

  const duplicateWidget = (id: string) => {
    const source = screen.widgets.find((w) => w.id === id);
    if (!source) return;
    let n = 1;
    let nextId = `${id}.copy`;
    while (screen.widgets.some((w) => w.id === nextId)) nextId = `${id}.copy${++n}`;
    const copy: WidgetSpec = {
      ...clone(source),
      id: nextId,
      x: Math.min(layout.meta.display.width - source.w, source.x + 8),
      y: Math.min(layout.meta.display.height - source.h, source.y + 8),
    };
    setLayout((prev) => ({
      ...prev,
      screens: prev.screens.map((s) => {
        if (s.id !== screen.id) return s;
        const at = s.widgets.findIndex((w) => w.id === id);
        const widgets = [...s.widgets];
        widgets.splice(at + 1, 0, copy);
        return { ...s, widgets };
      }),
    }));
    setSelectedId(copy.id);
    markChanged();
  };

  const layerWidget = (id: string, direction: -1 | 1) => {
    setLayout((prev) => ({
      ...prev,
      screens: prev.screens.map((s) => {
        if (s.id !== screen.id) return s;
        const index = s.widgets.findIndex((w) => w.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= s.widgets.length) return s;
        const widgets = [...s.widgets];
        [widgets[index], widgets[target]] = [widgets[target], widgets[index]];
        return { ...s, widgets };
      }),
    }));
    markChanged();
  };

  const addWidget = (type: string) => {
    let n = 1;
    while (screen.widgets.some((w) => w.id === `${screen.id}.${type}${n}`)) n++;
    const widget = defaultWidget(screen.id, type, n);
    setLayout((prev) => ({
      ...prev,
      screens: prev.screens.map((s) => (s.id === screen.id ? { ...s, widgets: [...s.widgets, widget] } : s)),
    }));
    setSelectedId(widget.id);
    setTab('inspect');
    markChanged();
  };

  const chooseScreen = (id: string) => {
    setScreenId(id);
    const next = layout.screens.find((s) => s.id === id);
    const scenario = scenarios.scenarios.find((s) => s.id === scenarioKey);
    if (scenario && scenario.screen !== id) setScenarioKey('default');
    setSelectedId(next?.widgets[next.widgets.length - 1]?.id ?? null);
  };

  const focusIssue = (issue: LintIssue) => {
    if (issue.screen && layout.screens.some((s) => s.id === issue.screen)) {
      setScreenId(issue.screen);
    }
    if (issue.widget) setSelectedId(issue.widget);
    if (issue.scenario.startsWith('scenario:')) setScenarioKey(issue.scenario.slice('scenario:'.length));
    else if (issue.scenario === 'max') setScenarioKey('max');
    else setScenarioKey('default');
    setTab('inspect');
  };

  const simulateTap = useCallback(
    (x: number, y: number) => {
      const hit = [...screen.widgets].reverse().find((w) => x >= w.x && y >= w.y && x <= w.x + w.w && y <= w.y + w.h);
      if (hit) setSelectedId(hit.id);
      setToast(`TOUCH ${x},${y} -> ${hit?.id ?? 'none'}`);
      if (!hit?.action) return;
      const action = hit.action;
      if (action === 'home') chooseScreen('home');
      else if (action === 'settings') chooseScreen('settings');
      else if (action === 'errors') chooseScreen('errors');
      else if (action === 'about') chooseScreen('about');
      else if (action === 'calibrate' || action === 'startCalibration') chooseScreen('calibrate');
      else if (action === 'startQuick' || action === 'startFull' || action === 'again') {
        chooseScreen('running');
        setScenarioKey('default');
      } else if (action === 'stop') {
        chooseScreen('results');
        setScenarioKey('default');
      } else {
        setToast(`${hit.id} -> ${action}`);
      }
    },
    [screen, layout.screens, scenarioKey]
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!selected) return;
      const tag = (event.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      const step = event.shiftKey ? theme.metrics.grid : 1;
      let dx = 0;
      let dy = 0;
      if (event.key === 'ArrowLeft') dx = -step;
      else if (event.key === 'ArrowRight') dx = step;
      else if (event.key === 'ArrowUp') dy = -step;
      else if (event.key === 'ArrowDown') dy = step;
      else return;
      event.preventDefault();
      updateWidget(selected.id, { x: selected.x + dx, y: selected.y + dy });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const save = async () => {
    setSaving(true);
    setSaveState('Saving...');
    try {
      const res = await fetch('/api/save-layout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(layout),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setDirty(false);
      setSaveState('Generated');
      setToast('layout.json written; C++ tables regenerated');
    } catch (err) {
      setSaveState(`Save failed: ${String(err)}`);
      setToast('Save failed. Is the Vite dev server running?');
    } finally {
      setSaving(false);
    }
  };

  const screenCounts = new Map<string, number>();
  for (const issue of issues) {
    if (issue.severity === 'error') screenCounts.set(issue.screen, (screenCounts.get(issue.screen) ?? 0) + 1);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>
          <div>
            <div className="brand-name">UI LAB</div>
            <div className="brand-sub">UI STUDIO / PIXEL CONTRACT</div>
          </div>
        </div>
        <div className="top-status">
          <span className="chip">320 x 240</span>
          <span className="chip">GFX FONTS</span>
          <span className="chip">v{meta.layoutVersion}</span>
          <span className={`chip ${counts.errors ? 'bad' : counts.warnings ? 'warn' : 'good'}`}>
            {counts.errors ? `${counts.errors} ERR` : counts.warnings ? `${counts.warnings} WARN` : 'LINT CLEAN'}
          </span>
          {dirty && <span className="chip warn">UNSAVED</span>}
        </div>
        <div className="top-actions">
          <button className="btn ghost" onClick={() => { setLayout(clone(initialLayout)); setDirty(false); setSaveState('Reverted'); }}>
            Revert
          </button>
          <button className="btn primary" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Generating' : 'Save + generate'}
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="left-rail">
          <div className="rail-head">
            <span className="eyebrow">Screens</span>
            <span className="count">{layout.screens.length}</span>
          </div>
          <div className="screen-list">
            {layout.screens.map((s) => (
              <ScreenThumb
                key={s.id}
                screen={s}
                theme={theme}
                icons={icons}
                engine={engine}
                scenarios={scenarios}
                active={s.id === screen.id}
                issues={screenCounts.get(s.id) ?? 0}
                onClick={() => chooseScreen(s.id)}
              />
            ))}
          </div>

          <div className="rail-section">
            <div className="rail-head">
              <span className="eyebrow">Scenarios</span>
              <span className="count">{scenarios.scenarios.filter((s) => s.screen === screen.id).length + 2}</span>
            </div>
            <div className="scenario-list">
              <button
                data-scenario="default"
                className={scenarioKey === 'default' ? 'scenario active' : 'scenario'}
                onClick={() => setScenarioKey('default')}
              >
                <span>Default data</span>
                <small>runtime values</small>
              </button>
              <button
                data-scenario="max"
                className={scenarioKey === 'max' ? 'scenario active' : 'scenario'}
                onClick={() => setScenarioKey('max')}
              >
                <span>Worst-case text</span>
                <small>max length probes</small>
              </button>
              {scenarios.scenarios
                .filter((s) => s.screen === screen.id)
                .map((s) => (
                  <button
                    key={s.id}
                    data-scenario={s.id}
                    className={scenarioKey === s.id ? 'scenario active' : 'scenario'}
                    onClick={() => setScenarioKey(s.id)}
                  >
                    <span>{s.label}</span>
                    <small>{s.id}</small>
                  </button>
                ))}
            </div>
          </div>

          <div className="rail-section">
            <div className="rail-head">
              <span className="eyebrow">Add widget</span>
            </div>
            <div className="add-grid">
              <button onClick={() => addWidget('text')}>+ Text</button>
              <button onClick={() => addWidget('button')}>+ Button</button>
              <button onClick={() => addWidget('panel')}>+ Panel</button>
              <button onClick={() => addWidget('icon')}>+ Icon</button>
              <button onClick={() => addWidget('statCard')}>+ Stat</button>
              <button onClick={() => addWidget('progress')}>+ Bar</button>
            </div>
          </div>
        </aside>

        <section className="stage">
          <div className="stage-head">
            <div>
              <div className="eyebrow">Preview / {screen.title}</div>
              <div className="stage-title">
                {screen.id}
                <span className="slash">/</span>
                {scenarioLabel}
              </div>
            </div>
            <div className="stage-tools">
              <div className="segmented">
                <button className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>Edit</button>
                <button className={mode === 'touch' ? 'active' : ''} onClick={() => setMode('touch')}>Touch</button>
              </div>
              <div className="segmented zoom">
                {[1, 2, 3].map((z) => (
                  <button key={z} className={zoom === z ? 'active' : ''} onClick={() => setZoom(z)}>{z}x</button>
                ))}
              </div>
              <button className={`btn ghost small ${showGrid ? 'active' : ''}`} onClick={() => setShowGrid(!showGrid)}>Grid</button>
              <button className={`btn ghost small ${showBoxes ? 'active' : ''}`} onClick={() => setShowBoxes(!showBoxes)}>Boxes</button>
            </div>
          </div>

          <div className="stage-body">
            <ScreenPreview
              laid={laid}
              theme={theme}
              icons={icons}
              engine={engine}
              selectedId={selectedId}
              mode={mode}
              zoom={zoom}
              showGrid={showGrid}
              showBoxes={showBoxes}
              onSelect={(id) => { setSelectedId(id); if (id) setTab('inspect'); }}
              onMove={(id, x, y) => updateWidget(id, { x, y })}
              onResize={(id, w, h) => updateWidget(id, { w, h })}
              onTap={simulateTap}
            />
            <div className="stage-foot">
              <span className="mono">{screen.widgets.length} widgets</span>
              <span className="mono">{screenIssues.filter((i) => i.severity === 'error').length} errors in view</span>
              {selected && (
                <span className="mono selected-readout">
                  {selected.id} @ {selected.x},{selected.y} {selected.w}x{selected.h}
                </span>
              )}
              <span className="mono muted">{mode === 'touch' ? 'tap = host touch command' : 'drag = move / corner = resize'}</span>
            </div>
          </div>
        </section>

        <aside className="right-rail">
          <div className="tabs">
            {([
              ['inspect', 'Inspect'],
              ['issues', `Issues ${counts.errors + counts.warnings ? `(${counts.errors + counts.warnings})` : ''}`],
              ['code', 'Code'],
              ['device', 'Device'],
            ] as Array<[Tab, string]>).map(([key, label]) => (
              <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="tab-body">
            {tab === 'inspect' && (
              <Inspector
                widget={selected}
                onChange={updateWidget}
                onDelete={deleteWidget}
                onDuplicate={duplicateWidget}
                onLayer={layerWidget}
              />
            )}
            {tab === 'issues' && <IssuePanel issues={issues} allIssues={issues} screenId={screen.id} onFocus={focusIssue} />}
            {tab === 'code' && (
              <CodePanel layout={layout} screen={screen} dirty={dirty} saving={saving} saveState={saveState} onSave={save} />
            )}
            {tab === 'device' && <DevicePanel laid={laid} theme={theme} icons={icons} engine={engine} onTap={simulateTap} />}
          </div>
        </aside>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
