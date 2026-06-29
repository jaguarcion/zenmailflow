import { useState, useEffect } from 'react'
import { TokenCard } from './TokenCard'
import { ProxyCard } from './ProxyCard'
import { CheckerWorkspace } from './CheckerWorkspace'
import { ResultsTable } from './ResultsTable'
import { CheckerProvider } from './CheckerContext'
import { KeyRound } from 'lucide-react'

export default function KeysCheckerTab({ token }) {
  const [proxyCount, setProxyCount] = useState(0)

  useEffect(() => {
    fetch('/api/checker/api/proxy-count', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setProxyCount(data.count || 0))
      .catch(() => {})
  }, [token])

  return (
    <CheckerProvider token={token}>
      <div className="space-y-6 animate-in fade-in duration-500">
        


        {/* Top Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TokenCard token={token} />
          <ProxyCard count={proxyCount} setCount={setProxyCount} token={token} />
        </div>

        {/* Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1">
             <CheckerWorkspace />
          </div>
          <div className="lg:col-span-2">
             <ResultsTable />
          </div>
        </div>

      </div>
    </CheckerProvider>
  )
}
