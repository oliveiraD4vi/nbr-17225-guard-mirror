import React, { useCallback, useMemo, useState } from 'react'
import { message } from 'antd'

type AnnouncementPriority = 'polite' | 'assertive'

interface Announcement {
  id: number
  priority: AnnouncementPriority
  text: string
}

interface AccessibleMessageApi {
  error: (text: string) => void
  info: (text: string) => void
  success: (text: string) => void
  warning: (text: string) => void
}

export function useAccessibleMessage(): {
  announcer: React.ReactNode
  notify: AccessibleMessageApi
} {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)

  const announce = useCallback((text: string, priority: AnnouncementPriority) => {
    setAnnouncement({ id: Date.now(), priority, text })
  }, [])

  const notify = useMemo<AccessibleMessageApi>(
    () => ({
      error: (text) => {
        void message.error(text)
        announce(text, 'assertive')
      },
      info: (text) => {
        void message.info(text)
        announce(text, 'polite')
      },
      success: (text) => {
        void message.success(text)
        announce(text, 'polite')
      },
      warning: (text) => {
        void message.warning(text)
        announce(text, 'assertive')
      },
    }),
    [announce],
  )

  return {
    announcer: announcement ? (
      <span
        key={announcement.id}
        className="guard-visually-hidden"
        role={announcement.priority === 'assertive' ? 'alert' : 'status'}
        aria-live={announcement.priority}
        aria-atomic="true"
      >
        {announcement.text}
      </span>
    ) : null,
    notify,
  }
}
