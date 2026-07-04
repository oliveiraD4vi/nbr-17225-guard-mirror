import type { AuditReportSnapshot, AuditResult } from '@/types'
import { compactAuditResultForStorage, hydrateAuditResult } from '@/utils/audit-history'
import { extensionStorageGet, extensionStorageSet } from '@/utils/extension-storage'

export const REPORT_SNAPSHOTS_STORAGE_KEY = 'reportSnapshotsById'
const REPORT_SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000
const REPORT_SNAPSHOT_LIMIT = 12

function createSnapshotId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `report-${crypto.randomUUID()}`
  }

  return `report-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function cleanupSnapshots(
  snapshotsById: Record<string, AuditReportSnapshot>,
  now = Date.now(),
): Record<string, AuditReportSnapshot> {
  return Object.fromEntries(
    Object.entries(snapshotsById)
      .filter(([, snapshot]) => now - snapshot.createdAt <= REPORT_SNAPSHOT_TTL_MS)
      .sort(([, left], [, right]) => right.createdAt - left.createdAt)
      .slice(0, REPORT_SNAPSHOT_LIMIT),
  )
}

export async function saveReportSnapshot(result: AuditResult): Promise<AuditReportSnapshot> {
  const now = Date.now()
  const data = await extensionStorageGet(REPORT_SNAPSHOTS_STORAGE_KEY)
  const snapshotsById = cleanupSnapshots(
    (data[REPORT_SNAPSHOTS_STORAGE_KEY] as Record<string, AuditReportSnapshot> | undefined) ?? {},
    now,
  )
  const snapshot: AuditReportSnapshot = {
    id: createSnapshotId(),
    createdAt: now,
    auditResult: compactAuditResultForStorage(hydrateAuditResult(result)),
  }

  await extensionStorageSet({
    [REPORT_SNAPSHOTS_STORAGE_KEY]: cleanupSnapshots(
      {
        ...snapshotsById,
        [snapshot.id]: snapshot,
      },
      now,
    ),
  })

  return snapshot
}

export async function getReportSnapshot(snapshotId: string): Promise<AuditResult | null> {
  const data = await extensionStorageGet(REPORT_SNAPSHOTS_STORAGE_KEY)
  const snapshotsById =
    (data[REPORT_SNAPSHOTS_STORAGE_KEY] as Record<string, AuditReportSnapshot> | undefined) ?? {}
  const cleanedSnapshotsById = cleanupSnapshots(snapshotsById)
  const snapshot = cleanedSnapshotsById[snapshotId]

  if (Object.keys(cleanedSnapshotsById).length !== Object.keys(snapshotsById).length) {
    await extensionStorageSet({ [REPORT_SNAPSHOTS_STORAGE_KEY]: cleanedSnapshotsById })
  }

  return snapshot ? hydrateAuditResult(snapshot.auditResult) : null
}
