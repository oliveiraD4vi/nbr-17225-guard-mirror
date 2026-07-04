import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import ptBR from 'antd/locale/pt_BR'
import { DevToolsPanelApp } from './components/DevToolsPanelApp'
import { createGuardAntTheme } from './theme/antd'
import './styles/theme.css'
import './styles/popup.css'
import './styles/devtools.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)
const antTheme = createGuardAntTheme()

root.render(
  <React.StrictMode>
    <ConfigProvider
      locale={ptBR}
      theme={antTheme}
    >
      <DevToolsPanelApp />
    </ConfigProvider>
  </React.StrictMode>,
)
