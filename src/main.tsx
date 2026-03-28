import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import App from './App'
import './index.css'

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'google', 'apple', 'twitter', 'discord'],
        appearance: {
          theme: 'dark',
          accentColor: '#7c3aed',
        },
        embeddedWallets: {
          ethereum: { createOnLogin: 'all-users' },
        },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>,
)
