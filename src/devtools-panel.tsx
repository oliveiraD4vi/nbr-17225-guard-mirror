import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, Empty } from 'antd'
import ptBR from 'antd/locale/pt_BR'
import { PopupApp } from './components/PopupApp'
import { t } from './i18n'
import type { AuditTargetTab } from './utils/audit-engine'
import './styles/theme.css'
import './styles/popup.css'
import './styles/devtools.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)
const cssRoot = document.documentElement

function resolveGuardToken(variableName: string, fallback: string) {
  const resolved = getComputedStyle(cssRoot).getPropertyValue(variableName).trim()
  return resolved || fallback
}

const antThemeTokens = {
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
}

const antThemeComponents = {
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
}

interface InspectedPageInfo {
  title?: string
  url?: string
}

function readInspectedPageInfo(): Promise<InspectedPageInfo> {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(
      '({ title: document.title, url: window.location.href })',
      (result, exceptionInfo) => {
        if (exceptionInfo || !result || typeof result !== 'object') {
          resolve({})
          return
        }

        const pageInfo = result as InspectedPageInfo
        resolve({
          title: typeof pageInfo.title === 'string' ? pageInfo.title : undefined,
          url: typeof pageInfo.url === 'string' ? pageInfo.url : undefined,
        })
      },
    )
  })
}

const DevToolsPanelApp: React.FC = () => {
  const inspectedTabId = chrome.devtools?.inspectedWindow?.tabId
  const [targetTab, setTargetTab] = React.useState<AuditTargetTab | null>(
    inspectedTabId ? { id: inspectedTabId } : null,
  )

  React.useEffect(() => {
    if (!inspectedTabId) return undefined
    let disposed = false

    const syncInspectedPage = async (navigatedUrl?: string) => {
      const pageInfo = await readInspectedPageInfo()
      if (disposed) return
      setTargetTab({
        id: inspectedTabId,
        title: pageInfo.title,
        url: pageInfo.url || navigatedUrl,
      })
    }

    const handleNavigated = (url: string) => {
      void syncInspectedPage(url)
    }

    void syncInspectedPage()
    chrome.devtools.network.onNavigated.addListener(handleNavigated)

    return () => {
      disposed = true
      chrome.devtools.network.onNavigated.removeListener(handleNavigated)
    }
  }, [inspectedTabId])

  if (!targetTab) {
    return <Empty className="devtools-empty" description={t('devtools.unavailable')} />
  }

  return <PopupApp surface="devtools" targetTab={targetTab} />
}

root.render(
  <React.StrictMode>
    <ConfigProvider
      locale={ptBR}
      theme={{
        token: antThemeTokens,
        components: antThemeComponents,
      }}
    >
      <DevToolsPanelApp />
    </ConfigProvider>
  </React.StrictMode>,
)
