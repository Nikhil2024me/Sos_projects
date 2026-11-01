import themeJson from './generated/theme.json';
import iconsJson from './generated/icons.json';
import layoutJson from './generated/layout.json';
import scenariosJson from './generated/scenarios.json';
import fontsJson from './generated/fonts.json';
import metaJson from './generated/meta.json';
import { createLayoutEngine } from '@shared/lib/layout-engine';
import type { IconDoc, LayoutDoc, Theme } from '@shared/lib/layout-engine';
import type { ScenarioDoc } from './lib/lint';

export const theme = themeJson as unknown as Theme;
export const icons = iconsJson as unknown as IconDoc;
export const initialLayout = layoutJson as unknown as LayoutDoc;
export const scenarios = scenariosJson as unknown as ScenarioDoc;
export const meta = metaJson as {
  bindings: string[];
  toneBindings: string[];
  actions: string[];
  screens: string[];
  fonts: string[];
  colors: string[];
  icons: string[];
  layoutVersion: string;
};

export const engine = createLayoutEngine({
  theme,
  icons,
  fonts: fontsJson as unknown as { fonts: Record<string, any> },
});
