import React from 'react'
import { Button, Spin, Tag } from 'antd'
import { FileTextOutlined, ToolOutlined } from '@ant-design/icons'
import { PROJECT_PAGE_URL } from '@/config/links'
import { t } from '@/i18n'
import type { AuditResult } from '@/types'
import { getAuditResult, getAuditTargetTab, type AuditTargetTab } from '@/utils/audit-engine'
import { APP_VERSION } from '@/version'

export const PopupLandingApp: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<AuditTargetTab | null>(null)
  const [auditResult, setAuditResult] = React.useState<AuditResult | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [openingReport, setOpeningReport] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState('')
  const appIconUrl = React.useMemo(() => chrome.runtime.getURL('icons/icon.png'), [])

  React.useEffect(() => {
    let disposed = false

    const loadCurrentAudit = async () => {
      try {
        const tab = await getAuditTargetTab()
        const result = await getAuditResult(tab.id, tab.url)
        if (disposed) return
        setActiveTab(tab)
        setAuditResult(result)
      } catch (error) {
        console.error(t('popup.guide.loadError'), error)
        if (!disposed) setStatusMessage(t('popup.guide.loadError'))
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    void loadCurrentAudit()
    return () => {
      disposed = true
    }
  }, [])

  const handleOpenReport = async () => {
    if (!auditResult) return
    setOpeningReport(true)
    setStatusMessage('')

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'OPEN_REPORT',
        auditResult,
      })
      if (response?.error) throw new Error(response.error)
    } catch (error) {
      console.error(t('popup.messages.reportOpenError'), error)
      setStatusMessage(t('popup.messages.reportOpenError'))
    } finally {
      setOpeningReport(false)
    }
  }

  const pageTitle = auditResult?.pageTitle || activeTab?.title || activeTab?.url

  return (
    <main className="popup-guide-app">
      <header className="popup-guide-header">
        <div className="popup-guide-brand">
          <img src={appIconUrl} alt="" aria-hidden="true" />
          <div>
            <strong>{t('shared.brand.name')}</strong>
            <span>v{APP_VERSION}</span>
          </div>
        </div>
        <Tag color="gold">{t('shared.states.beta')}</Tag>
      </header>

      <section className="popup-guide-intro">
        <span className="popup-guide-icon" aria-hidden="true">
          <ToolOutlined />
        </span>
        <p className="popup-guide-eyebrow">{t('popup.guide.eyebrow')}</p>
        <h1>{t('popup.guide.title')}</h1>
        <p>{t('popup.guide.description')}</p>
        <ol>
          <li>{t('popup.guide.stepOpen')}</li>
          <li>{t('popup.guide.stepSelect')}</li>
          <li>{t('popup.guide.stepAudit')}</li>
        </ol>
        <p className="popup-guide-shortcut">{t('popup.guide.shortcut')}</p>
      </section>

      <section className="popup-guide-report" aria-labelledby="popup-current-audit-title">
        <div>
          <span id="popup-current-audit-title">{t('popup.guide.currentAudit')}</span>
          {loading ? (
            <Spin size="small" />
          ) : auditResult ? (
            <>
              <strong title={pageTitle}>{pageTitle}</strong>
              <small>{new Date(auditResult.timestamp).toLocaleString('pt-BR')}</small>
            </>
          ) : (
            <p>{t('popup.guide.noCurrentAudit')}</p>
          )}
        </div>
        <Button
          type="primary"
          block
          icon={<FileTextOutlined />}
          loading={openingReport}
          disabled={loading || !auditResult}
          onClick={() => {
            void handleOpenReport()
          }}
        >
          {t('shared.actions.openReport')}
        </Button>
      </section>

      <footer className="popup-guide-footer">
        <a href={PROJECT_PAGE_URL} target="_blank" rel="noreferrer">
          {t('popup.guide.projectPage')}
        </a>
        <span aria-live="polite">{statusMessage}</span>
      </footer>
    </main>
  )
}
