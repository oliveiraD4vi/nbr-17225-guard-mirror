import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { Alert, Button, ConfigProvider, Empty, Layout, Space } from 'antd'
import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons'
import ptBR from 'antd/locale/pt_BR'
import { ReportSkeleton } from './components/LoadingSkeletons'
import { t } from './i18n'
import type { AuditResult } from './types'
import { buildExportableAuditResult } from './utils/audit-export'
import { getActiveTab, getAuditResult, getDisplayResultForScope } from './utils/audit-engine'
import './styles/theme.css'
import './styles/popup.css'

const ViolationsList = React.lazy(async () => {
  const module = await import('./components/ViolationsList')
  return { default: module.ViolationsList }
})

const ViolationsSummary = React.lazy(async () => {
  const module = await import('./components/ViolationsSummary')
  return { default: module.ViolationsSummary }
})

const { Header, Content, Footer } = Layout
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

export const ReportApp: React.FC = () => {
  const [auditResult, setAuditResult] = React.useState<AuditResult | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    void loadAuditResult()
  }, [])

  const loadAuditResult = async () => {
    try {
      const tab = await getActiveTab()
      const result = await getAuditResult(tab.id)
      setAuditResult(result)
    } catch (error) {
      console.error('Erro ao carregar resultado:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = React.useCallback(() => {
    window.print()
  }, [])

  const handleExport = React.useCallback(() => {
    if (!auditResult) return

    const dataStr = JSON.stringify(buildExportableAuditResult(auditResult), null, 2)
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${t('shared.exports.reportFilePrefix')}-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [auditResult])

  const displayedAuditResult = auditResult
    ? getDisplayResultForScope(
        auditResult,
        auditResult.includeRecommendations ?? true,
        auditResult.includeHumanReview ?? true,
      )
    : null

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--guard-color-page-bg)' }}>
      <Header
        style={{
          background: 'var(--guard-color-surface)',
          color: 'var(--guard-color-text-primary)',
          borderBottom: '1px solid var(--guard-color-border)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '24px' }}>{t('report.title')}</h1>
      </Header>

      <Content style={{ padding: '24px' }}>
        {loading ? (
          <ReportSkeleton />
        ) : !auditResult ? (
          <Empty description={t('report.empty')} />
        ) : (
          <>
            <Alert
              style={{ marginBottom: '16px' }}
              type="info"
              showIcon
              message={t('report.introTitle')}
              description={t('report.introDescription')}
            />
            <Suspense fallback={<ReportSkeleton />}>
              <ViolationsSummary result={displayedAuditResult} reviewSourceResult={auditResult} />
              <div style={{ marginTop: '24px' }}>
                <h2>{t('report.violationsTitle')}</h2>
                <ViolationsList violations={auditResult.violations} />
              </div>
            </Suspense>
          </>
        )}
      </Content>

      <Footer
        style={{
          textAlign: 'center',
          background: 'var(--guard-color-surface-muted)',
          padding: '16px',
        }}
      >
        <Space>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            {t('shared.actions.print')}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            {t('shared.actions.exportJson')}
          </Button>
        </Space>
      </Footer>
    </Layout>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <ConfigProvider
      locale={ptBR}
      theme={{
        token: antThemeTokens,
        components: antThemeComponents,
      }}
    >
      <ReportApp />
    </ConfigProvider>
  </React.StrictMode>,
)
