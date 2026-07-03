import { t } from './i18n'

chrome.devtools.panels.create(t('devtools.panelTitle'), 'icons/icon.png', 'src/devtools-panel.html')
