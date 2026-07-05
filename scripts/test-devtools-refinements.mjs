import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const [workspaceSource, violationsSource, aboutSource, popupCss] = await Promise.all([
  fs.readFile('src/components/AuditWorkspaceApp.tsx', 'utf8'),
  fs.readFile('src/components/ViolationsList.tsx', 'utf8'),
  fs.readFile('src/components/AboutPanel.tsx', 'utf8'),
  fs.readFile('src/styles/popup.css', 'utf8'),
])

assert.doesNotMatch(violationsSource, /reviewSections\.confirmed/)
assert.match(violationsSource, /sortedViolations\.filter\(isPendingHumanReviewFinding\)/)
assert.match(workspaceSource, /action\.key === 'csv' \? 'CSV'/)
assert.match(workspaceSource, /action\.key === 'json' \? 'JSON'/)
assert.match(popupCss, /\.footer-icon-action[\s\S]*?width: 36px/)
assert.match(popupCss, /\.footer-icon-action[\s\S]*?height: 36px/)
assert.match(popupCss, /\.footer-icon-action[\s\S]*?border-radius: 999px !important/)
assert.match(popupCss, /\.footer-download-action[\s\S]*?border-radius: 999px !important/)
assert.match(popupCss, /\.vision-floating-shell[\s\S]*?bottom: 4\.5rem/)
assert.match(aboutSource, /about-capabilities/)
assert.match(aboutSource, /about-privacy-note/)

console.log('DevTools refinement checks passed.')
