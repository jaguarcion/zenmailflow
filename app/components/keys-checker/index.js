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
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">Чекер Adobe ключей</h2>
            <p className="text-sm text-slate-500">Массовая проверка валидности redemption-кодов</p>
          </div>
        </div>

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
