export interface Glyph {
  code: number;
  offset: number;
  width: number;
  height: number;
  xAdvance: number;
  xOffset: number;
  yOffset: number;
}

export interface FontData {
  id: string;
  first: number;
  last: number;
  yAdvance: number;
  ascent: number;
  descent: number;
  height: number;
  bitmap: string;
  glyphs: Glyph[];
}

export interface Theme {
  name: string;
  display: { width: number; height: number; rotation: number; margin: number };
  colors: Record<string, string>;
  fonts: Record<string, string>;
  metrics: {
    header: number;
    margin: number;
    gap: number;
    radius: number;
    radiusSmall: number;
    touchMin: number;
    touchPrimary: number;
    grid: number;
  };
}

export interface IconPrimitive {
  type: 'line' | 'poly' | 'rect' | 'circle';
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  r?: number;
  cx?: number;
  cy?: number;
  points?: number[][];
  fill?: boolean;
  closed?: boolean;
}

export interface IconDoc {
  grid: number;
  stroke: number;
  icons: Record<string, IconPrimitive[]>;
}

export interface WidgetSpec {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  font?: string;
  color?: string;
  tone?: string;
  background?: string;
  variant?: string;
  label?: string;
  text?: string;
  title?: string;
  subtitle?: string;
  subtext?: string;
  unit?: string;
  icon?: string;
  size?: number;
  binding?: string;
  binding2?: string;
  valueBinding?: string;
  detailBinding?: string;
  statusBinding?: string;
  rightBinding?: string;
  toneBinding?: string;
  action?: string;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  wrap?: boolean;
  compact?: boolean;
  back?: boolean;
  style?: string;
  radius?: number;
  segments?: number;
  cols?: number;
  rows?: number;
  mode?: 'bit' | 'address' | 'scan';
  emptyText?: string;
  status?: string;
  value?: string;
}

export interface ScreenSpec {
  id: string;
  title: string;
  background?: string;
  widgets: WidgetSpec[];
}

export interface LayoutDoc {
  meta: { name: string; version: string; display: { width: number; height: number }; grid: number };
  screens: ScreenSpec[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface InkBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface TextLine {
  text: string;
  x: number;
  baseline: number;
  width: number;
}
export interface TextBox {
  kind: 'text';
  id: string;
  role: string;
  text: string;
  font: string;
  color: string;
  bg: string;
  box: Box;
  align: string;
  valign: string;
  wrap: boolean;
  lineHeight: number;
  textHeight: number;
  lines: TextLine[];
  ink: InkBox;
}
export interface IconBox {
  kind: 'icon';
  id: string;
  role: string;
  icon: string;
  color: string;
  bg: string;
  size: number;
  box: Box;
  ink: InkBox;
  viewBox: number;
}
export interface LayoutIssue {
  code: string;
  severity: 'error' | 'warning';
  widget?: { id: string; type: string; screen: string };
  text?: string;
  message: string;
}
export interface WidgetLayout {
  id: string;
  type: string;
  rect: Box;
  tone: string;
  color: string;
  iconColor: string;
  bg: string;
  border: string | null;
  radius: number;
  flags: { wrap: boolean; compact: boolean; back: boolean };
  widget: WidgetSpec;
  texts: TextBox[];
  icons: IconBox[];
  extra: Record<string, any>;
  interactive: boolean;
  issues: LayoutIssue[];
}
export interface LaidOutScreen {
  screenId: string;
  title: string;
  bg: string;
  width: number;
  height: number;
  widgets: WidgetLayout[];
  texts: TextBox[];
  icons: IconBox[];
  issues: LayoutIssue[];
}
export interface Scene {
  screenId?: string;
  values?: Record<string, string>;
  tones?: Record<string, string>;
  progress?: number;
  errors?: Array<Record<string, string>>;
  bitErrors?: number[];
  addrErrors?: number[];
  errorPage?: number;
}
export interface LayoutEngine {
  theme: Theme;
  icons: IconDoc;
  fonts: Record<string, FontData>;
  measureText(fontId: string, text: string): number;
  missingGlyphs(fontId: string, text: string): string[];
  wrapText(fontId: string, text: string, maxWidth: number): string[];
  textBlock(spec: any): TextBox;
  layoutScreen(screen: ScreenSpec, scene?: Scene): LaidOutScreen;
  resolveFont(id: string): { key: string; font: FontData };
}

export function createLayoutEngine(input: {
  theme: Theme;
  icons: IconDoc;
  fonts: { fonts: Record<string, FontData> } | Record<string, FontData>;
}): LayoutEngine;
export function contrastRatio(a: string, b: string): number;
export function relativeLuminance(hex: string): number;
export function hexToRgb(hex: string): { r: number; g: number; b: number };
export function boxesIntersect(a: InkBox, b: InkBox, pad?: number): boolean;
