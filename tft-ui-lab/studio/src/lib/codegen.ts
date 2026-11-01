import type { LayoutDoc, ScreenSpec, Theme } from '@shared/lib/layout-engine';

const upperSnake = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

const cstr = (value: string | null | undefined) => (value == null ? 'nullptr' : JSON.stringify(value));

export function screenWidgetTable(screen: ScreenSpec, theme: Theme): string {
  const lines: string[] = [];
  const name = upperSnake(screen.id);
  lines.push(`static const Widget SCREEN_${name}_WIDGETS[] PROGMEM = {`);
  for (const w of screen.widgets) {
    const font = theme.fonts[(w.font ?? 'body') as keyof Theme['fonts']] ?? w.font ?? 'sans9';
    const flags = (w.wrap ? 1 : 0) | (w.compact ? 2 : 0) | (w.back ? 4 : 0);
    const mode = w.mode === 'bit' ? 0 : w.mode === 'address' ? 1 : w.mode === 'scan' ? 2 : 0;
    const tone = w.tone ?? 'accent';
    const toneBinding = w.toneBinding ? `TB_${upperSnake(w.toneBinding)}` : 'TB_NONE';
    const action = w.action ? `ACTION_${upperSnake(w.action)}` : 'ACTION_NONE';
    const icon = w.icon ? `ICON_${upperSnake(w.icon)}` : 'ICON_CHIP';
    const iconSize = w.size ?? (w.type === 'header' ? 16 : w.type === 'button' ? 16 : w.type === 'statCard' ? 18 : w.type === 'logo' ? 40 : w.type === 'icon' ? 24 : 0);
    const binding = w.binding ?? w.valueBinding ?? w.statusBinding;
    const binding2 = w.binding2 ?? w.detailBinding ?? w.rightBinding;
    const color = w.color ?? w.tone ?? 'text';
    const align = w.align === 'center' ? 'ALIGN_CENTER' : w.align === 'right' ? 'ALIGN_RIGHT' : 'ALIGN_LEFT';
    const valign = w.valign === 'middle' ? 'VALIGN_MIDDLE' : w.valign === 'bottom' ? 'VALIGN_BOTTOM' : 'VALIGN_TOP';
    const label = w.label ?? w.text ?? null;
    const subtext = w.subtext ?? w.unit ?? null;
    lines.push(
      `  { ${w.x}, ${w.y}, ${w.w}, ${w.h}, WIDGET_${upperSnake(w.type)}, VARIANT_${upperSnake(w.variant ?? 'card')}, FONT_${upperSnake(font)}, COL_${upperSnake(color)}, TONE_${upperSnake(tone)}, ${toneBinding}, ${align}, ${valign}, ${action}, ${icon}, ${iconSize}, ${binding ? `BIND_${upperSnake(binding)}` : 'BIND_NONE'}, ${binding2 ? `BIND_${upperSnake(binding2)}` : 'BIND_NONE'}, ${flags}, ${w.segments ?? 0}, ${w.cols ?? 0}, ${w.rows ?? 0}, ${mode}, ${w.radius ?? 0}, ${cstr(label)}, ${cstr(subtext)} },`
    );
  }
  lines.push('};');
  return lines.join('\n');
}

export function fullLayoutCode(layout: LayoutDoc): string {
  return JSON.stringify(layout, null, 2);
}

export function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
