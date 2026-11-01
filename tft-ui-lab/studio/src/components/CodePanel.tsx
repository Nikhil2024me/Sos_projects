import { useMemo, useState } from 'react';
import type { LayoutDoc, ScreenSpec } from '@shared/lib/layout-engine';
import { downloadText, fullLayoutCode, screenWidgetTable } from '../lib/codegen';
import { theme } from '../data';

interface Props {
  layout: LayoutDoc;
  screen: ScreenSpec;
  dirty: boolean;
  saving: boolean;
  saveState: string;
  onSave: () => void;
}

export default function CodePanel({ layout, screen, dirty, saving, saveState, onSave }: Props) {
  const [tab, setTab] = useState<'cpp' | 'json'>('cpp');
  const [copied, setCopied] = useState(false);
  const code = useMemo(
    () => (tab === 'cpp' ? screenWidgetTable(screen, theme) : fullLayoutCode(layout)),
    [layout, screen, tab]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="code-panel">
      <div className="code-head">
        <div className="segmented">
          <button className={tab === 'cpp' ? 'active' : ''} onClick={() => setTab('cpp')}>
            C++ widgets
          </button>
          <button className={tab === 'json' ? 'active' : ''} onClick={() => setTab('json')}>
            layout.json
          </button>
        </div>
        <button className="btn small" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="generated-note">
        <span className={`status-dot ${dirty ? 'warn' : 'ok'}`} />
        {dirty ? 'Unsaved layout edits' : 'Generated data in sync'}
        {saveState && <span className="save-state">{saveState}</span>}
      </div>
      <pre className="code-block" data-testid="code-block">
        {code}
      </pre>
      <div className="code-actions">
        <button className="btn small" onClick={() => downloadText('layout.json', fullLayoutCode(layout))}>
          Download JSON
        </button>
        <button className="btn primary small" disabled={saving || !dirty} onClick={onSave}>
          {saving ? 'Generating...' : 'Save + regenerate'}
        </button>
      </div>
      <p className="panel-note">
        Saving writes <code>shared/layout.json</code> through the dev server, then runs <code>tools/gen.mjs</code> to
        refresh the studio data and the C++ layout tables in <code>shared/generated/firmware/</code>.
      </p>
    </div>
  );
}
