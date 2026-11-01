import type { Theme, WidgetSpec } from '@shared/lib/layout-engine';
import { theme, icons } from '../data';

interface Props {
  widget: WidgetSpec | null;
  onChange: (id: string, patch: Partial<WidgetSpec>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onLayer: (id: string, direction: -1 | 1) => void;
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field compact">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(Math.round(next));
        }}
      />
    </label>
  );
}

function TextField({ label, value, onChange, mono = false }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className={mono ? 'mono' : ''} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" />
      <span>{label}</span>
    </label>
  );
}

export default function Inspector({ widget, onChange, onDelete, onDuplicate, onLayer }: Props) {
  if (!widget) {
    return (
      <div className="empty-state">
        <div className="empty-mark">+</div>
        <h3>No widget selected</h3>
        <p>Click a widget on the pixel canvas to inspect its geometry and content.</p>
        <p className="hint">Drag to move. Drag the square handle to resize. Arrow keys nudge by 1 px.</p>
      </div>
    );
  }

  const set = (patch: Partial<WidgetSpec>) => onChange(widget.id, patch);
  const textValue = widget.text ?? widget.label ?? widget.title ?? '';
  const showText = ['text', 'button', 'logo', 'header', 'statCard', 'settingRow', 'errorList'].includes(widget.type);
  const showBinding = Boolean(widget.binding || widget.valueBinding || widget.statusBinding || widget.binding2 || widget.detailBinding || widget.rightBinding);
  const iconOptions = Object.keys(icons.icons);

  return (
    <div className="inspector" data-testid="inspector">
      <div className="inspector-head">
        <div>
          <div className="eyebrow">{widget.type}</div>
          <div className="inspector-id mono">{widget.id}</div>
        </div>
        <div className="layer-buttons">
          <button title="Move down" onClick={() => onLayer(widget.id, -1)}>-</button>
          <button title="Move up" onClick={() => onLayer(widget.id, 1)}>+</button>
        </div>
      </div>

      <section>
        <h4>Geometry</h4>
        <div className="grid-2">
          <NumberField label="X" value={widget.x} min={-320} onChange={(v) => set({ x: v })} />
          <NumberField label="Y" value={widget.y} min={-240} onChange={(v) => set({ y: v })} />
          <NumberField label="W" value={widget.w} min={1} max={640} onChange={(v) => set({ w: v })} />
          <NumberField label="H" value={widget.h} min={1} max={480} onChange={(v) => set({ h: v })} />
        </div>
        <NumberField label="Radius" value={widget.radius ?? 0} min={0} max={100} onChange={(v) => set({ radius: v })} />
      </section>

      <section>
        <h4>Content</h4>
        {showText && (
          <TextField
            label={widget.type === 'button' ? 'Label' : widget.type === 'logo' ? 'Title' : 'Text'}
            value={textValue}
            onChange={(v) => {
              if (widget.type === 'button') set({ label: v });
              else if (widget.type === 'logo' || widget.type === 'header') set({ title: v });
              else set({ text: v });
            }}
          />
        )}
        {(widget.type === 'statCard' || widget.type === 'header' || widget.type === 'settingRow') && (
          <TextField label="Label" value={widget.label ?? ''} onChange={(v) => set({ label: v })} />
        )}
        {widget.type === 'logo' && (
          <TextField label="Subtitle" value={widget.subtitle ?? ''} onChange={(v) => set({ subtitle: v })} />
        )}
        {widget.type === 'statCard' && (
          <TextField label="Subtext" value={widget.subtext ?? widget.unit ?? ''} onChange={(v) => set({ subtext: v })} />
        )}
        {widget.type === 'header' && (
          <TextField label="Status" value={widget.status ?? ''} onChange={(v) => set({ status: v || undefined })} />
        )}
        {showBinding && (
          <div className="binding-list">
            <span className="eyebrow">Bound data</span>
            {[widget.binding, widget.valueBinding, widget.statusBinding, widget.binding2, widget.detailBinding, widget.rightBinding]
              .filter(Boolean)
              .map((binding) => (
                <code key={binding}>{binding}</code>
              ))}
          </div>
        )}
      </section>

      <section>
        <h4>Type & style</h4>
        <SelectField
          label="Font"
          value={widget.font ?? 'body'}
          options={Object.keys(theme.fonts)}
          onChange={(v) => set({ font: v })}
        />
        <div className="grid-2">
          <SelectField
            label="Color"
            value={widget.color ?? 'text'}
            options={Object.keys(theme.colors)}
            onChange={(v) => set({ color: v })}
          />
          <SelectField
            label="Tone"
            value={widget.tone ?? 'accent'}
            options={Object.keys(theme.colors)}
            onChange={(v) => set({ tone: v })}
          />
        </div>
        <SelectField
          label="Icon"
          value={widget.icon ?? ''}
          options={['', ...iconOptions]}
          onChange={(v) => set({ icon: v || undefined })}
        />
        {['button', 'panel'].includes(widget.type) && (
          <SelectField
            label="Variant"
            value={widget.variant ?? (widget.type === 'panel' ? 'card' : 'secondary')}
            options={widget.type === 'panel' ? ['card', 'flat'] : ['primary', 'secondary', 'ghost', 'danger', 'outline']}
            onChange={(v) => set({ variant: v })}
          />
        )}
        {widget.type === 'text' && (
          <div className="grid-2">
            <SelectField
              label="Align"
              value={widget.align ?? 'left'}
              options={['left', 'center', 'right']}
              onChange={(v) => set({ align: v as WidgetSpec['align'] })}
            />
            <SelectField
              label="Valign"
              value={widget.valign ?? 'top'}
              options={['top', 'middle', 'bottom']}
              onChange={(v) => set({ valign: v as WidgetSpec['valign'] })}
            />
          </div>
        )}
        <div className="toggles">
          {widget.type === 'text' && <Toggle label="Wrap" checked={!!widget.wrap} onChange={(v) => set({ wrap: v })} />}
          {['statCard'].includes(widget.type) && <Toggle label="Compact" checked={!!widget.compact} onChange={(v) => set({ compact: v })} />}
          {widget.type === 'header' && <Toggle label="Back arrow" checked={!!widget.back} onChange={(v) => set({ back: v })} />}
        </div>
      </section>

      {(widget.type === 'progress' || widget.type === 'heatmap') && (
        <section>
          <h4>Data shape</h4>
          <div className="grid-2">
            {widget.type === 'progress' && (
              <NumberField label="Segments" value={widget.segments ?? 0} min={0} max={128} onChange={(v) => set({ segments: v })} />
            )}
            {widget.type === 'heatmap' && (
              <>
                <NumberField label="Cols" value={widget.cols ?? 32} min={1} max={64} onChange={(v) => set({ cols: v })} />
                <NumberField label="Rows" value={widget.rows ?? 1} min={1} max={16} onChange={(v) => set({ rows: v })} />
              </>
            )}
          </div>
        </section>
      )}

      <section>
        <h4>Runtime</h4>
        <div className="kv">
          <span>Action</span>
          <code>{widget.action ?? 'none'}</code>
          <span>Tone binding</span>
          <code>{widget.toneBinding ?? 'none'}</code>
        </div>
      </section>

      <div className="inspector-actions">
        <button className="btn" onClick={() => onDuplicate(widget.id)}>Duplicate</button>
        <button className="btn danger" onClick={() => onDelete(widget.id)}>Delete</button>
      </div>
    </div>
  );
}
