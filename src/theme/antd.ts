import type { ThemeConfig } from 'antd'

function resolveGuardToken(variableName: string, fallback: string): string {
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim()
  return resolved || fallback
}

export function createGuardAntTheme(): ThemeConfig {
  return {
    token: {
      colorPrimary: resolveGuardToken('--guard-color-primary', '#0f766e'),
      colorBgBase: resolveGuardToken('--guard-color-page-bg', '#f3f6fb'),
      colorBgLayout: resolveGuardToken('--guard-color-page-bg', '#f3f6fb'),
      colorBgContainer: resolveGuardToken('--guard-color-surface', '#ffffff'),
      colorBgElevated: resolveGuardToken('--guard-color-surface', '#ffffff'),
      colorBgSpotlight: resolveGuardToken('--guard-color-tooltip-bg', '#0f172a'),
      colorFillAlter: resolveGuardToken('--guard-color-surface-muted', '#f8fafc'),
      colorBorder: resolveGuardToken('--guard-color-border', '#e2e8f0'),
      colorBorderSecondary: resolveGuardToken('--guard-color-border', '#e2e8f0'),
      colorSplit: resolveGuardToken('--guard-color-border', '#e2e8f0'),
      colorTextBase: resolveGuardToken('--guard-color-text-primary', '#0f172a'),
      colorText: resolveGuardToken('--guard-color-text-primary', '#0f172a'),
      colorTextSecondary: resolveGuardToken('--guard-color-text-secondary', '#475569'),
      colorTextLightSolid: resolveGuardToken('--guard-color-tooltip-text', '#ffffff'),
      borderRadius: 8,
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    },
    components: {
      Button: {
        defaultBg: resolveGuardToken('--guard-color-surface', '#ffffff'),
        defaultBorderColor: resolveGuardToken('--guard-color-border', '#e2e8f0'),
        defaultColor: resolveGuardToken('--guard-color-text-primary', '#0f172a'),
        colorPrimary: resolveGuardToken('--guard-color-primary', '#0f766e'),
        colorPrimaryHover: resolveGuardToken('--guard-color-primary-strong', '#115e59'),
        colorPrimaryActive: resolveGuardToken('--guard-color-primary-strong', '#115e59'),
        primaryColor: '#ffffff',
      },
      Tag: {
        defaultBg: resolveGuardToken('--guard-color-surface', '#ffffff'),
        defaultColor: resolveGuardToken('--guard-color-text-primary', '#0f172a'),
        defaultBorderColor: resolveGuardToken('--guard-color-border', '#e2e8f0'),
      },
      Tooltip: {
        colorBgSpotlight: resolveGuardToken('--guard-color-tooltip-bg', '#0f172a'),
        colorTextLightSolid: resolveGuardToken('--guard-color-tooltip-text', '#ffffff'),
      },
    },
  }
}
