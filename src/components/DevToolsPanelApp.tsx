import React from 'react'
import { Empty } from 'antd'
import { PopupApp } from './PopupApp'
import { t } from '@/i18n'
import type { AuditTargetTab } from '@/utils/audit-engine'

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

export const DevToolsPanelApp: React.FC = () => {
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
