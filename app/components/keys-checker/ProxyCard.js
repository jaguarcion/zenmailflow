import { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Server, Loader2 } from 'lucide-react'

// Simple Counter component instead of AnimatedCounter to simplify
const Counter = ({ value }) => <span>{value}</span>;

export function ProxyCard({ count, setCount, token: zenToken }) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingPrx, setLoadingPrx] = useState(false)

  // Load initial from API
  useEffect(() => {
    let mounted = true;
    fetch('/api/checker/proxy-autoupdate', { headers: { 'Authorization': `Bearer ${zenToken}` } })
      .then(r => r.json())
      .then(d => {
        if (mounted && d.url) setUrl(d.url);
      })
      .catch(()=>{});
    return () => { mounted = false; };
  }, [zenToken])

  // Auto-test when count becomes > 0
  const hasTested = useRef(false);
  useEffect(() => {
    if (count > 0 && !hasTested.current) {
      hasTested.current = true;
      testProxy();
    }
  }, [count])

  const loadProxies = async () => {
    if (!url) return toast.error('Введите URL или прокси')
    setLoadingPrx(true)
    try {
      const isProxyStr = url.split(/[\n, ]+/).length > 1 || url.includes('@') || /:\d+(:|$)/.test(url);
      const isUrl = !isProxyStr && (url.startsWith('http://') || url.startsWith('https://'));
      
      let res;
      if (isUrl) {
        res = await fetch('/api/checker/fetch-proxies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${zenToken}` },
          body: JSON.stringify({ url })
        })
        const data = await res.json()
        if (data.ok) {
          toast.success(`Загружено ${data.count} прокси`)
          fetch('/api/checker/api/proxy-count', { headers: { 'Authorization': `Bearer ${zenToken}` } })
            .then(r => r.json())
            .then(d => setCount(d.count))
        } else {
          toast.error('Ошибка: ' + data.error)
        }
      } else {
        const proxiesList = url.split(/[\n, ]+/).map(p => p.trim()).filter(Boolean);
        res = await fetch('/api/checker/proxies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${zenToken}` },
          body: JSON.stringify({ proxies: proxiesList })
        })
        const data = await res.json()
        toast.success(`Успешно загружены прокси`)
        setCount(data.count)
      }
    } catch(e) {
      toast.error('Ошибка сети')
    }
    setLoadingPrx(false)
  }

  const clearProxies = async () => {
    setLoadingPrx(true)
    try {
      const res = await fetch('/api/checker/proxies', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${zenToken}` }
      })
      const data = await res.json()
      if (data.ok) {
        setCount(0)
        setUrl('')
        toast.success('Прокси очищены. Используется IP сервера')
      }
    } catch(e) {
      toast.error('Ошибка очистки')
    }
    setLoadingPrx(false)
  }

  const testProxy = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/checker/test-proxy', { 
          method: 'POST', 
          headers: { 'Authorization': `Bearer ${zenToken}` } 
      })
      const data = await res.json()
      setStatus({ ok: data.ok, msg: data.info })
      if (data.ok) toast.success('Прокси работает!')
      else toast.error('Ошибка прокси')
    } catch(e) {
      setStatus({ ok: false, msg: 'Ошибка соединения' })
    }
    setLoading(false)
  }

  return (
    <Card className="bg-white/70 backdrop-blur-xl border-slate-200 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Server className="w-4 h-4 text-purple-500" />
          Прокси-серверы
        </CardTitle>
        <Badge variant="secondary" className="font-mono"><Counter value={count} /></Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button className="w-full text-xs shadow-[0_0_10px_rgba(168,85,247,0.3)] hover:shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all bg-purple-600 hover:bg-purple-700 text-white" onClick={testProxy} disabled={loading || count === 0}>
          {loading ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Проверка...</> : 'Проверить прокси'}
        </Button>
        {status && (
          <div className={`text-[11px] p-2 rounded bg-slate-50 font-mono border ${status.ok ? 'text-emerald-600 border-emerald-100' : 'text-rose-600 border-rose-100'}`}>
            {status.ok ? '✓' : '✗'} <b>{status.msg}</b>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Input 
            type="search"
            autoComplete="new-password"
            value={url} 
            onChange={(e) => setUrl(e.target.value)} 
            placeholder="URL или сами прокси" 
            className="font-mono text-xs flex-1"
          />
          <Button onClick={loadProxies} disabled={loadingPrx} variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100 hover:text-purple-700 transition-colors">
            {loadingPrx ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Загрузить'}
          </Button>
          <Button onClick={clearProxies} disabled={loadingPrx || count === 0} variant="outline" className="text-xs bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 hover:text-rose-700 transition-colors">
            Очистить
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
