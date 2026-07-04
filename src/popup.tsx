import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import ptBR from 'antd/locale/pt_BR'
import { PopupLandingApp } from './components/PopupLandingApp'
import { createGuardAntTheme } from './theme/antd'
import './styles/theme.css'
import './styles/popup-guide.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)
const antTheme = createGuardAntTheme()

root.render(
  <React.StrictMode>
    <ConfigProvider
      locale={ptBR}
      theme={antTheme}
    >
      <PopupLandingApp />
    </ConfigProvider>
  </React.StrictMode>,
)
