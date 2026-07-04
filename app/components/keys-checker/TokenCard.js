import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { KeyRound, User, Loader2 } from 'lucide-react'

export function TokenCard({ token: zenToken }) {
  const [token, setToken] = useState('')
  const [fingerprintToken, setFingerprintToken] = useState('')
  const [account, setAccount] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  // Auto-check on mount
  useEffect(() => {
    let mounted = true;
    fetch('/api/checker/api/config', {
      headers: { 'Authorization': `Bearer ${zenToken}` }
    })
      .then(r => r.json())
      .then(d => {
        if (!mounted) return;
        const savedToken = d.auth_token ? d.auth_token.split('\n')[0].trim() : '';
        const savedFingerprint = d.fingerprint_token ? d.fingerprint_token.split('\n')[0].trim() : '';
        const savedAccount = d.adobe_account ? d.adobe_account.split('\n')[0].trim() : '';
        
        setAccount(savedAccount);
        setFingerprintToken(savedFingerprint);
        if (savedToken) {
          setToken(savedToken);
          setLoading(true);
          fetch('/api/checker/api/test-token', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${zenToken}`
            },
            body: JSON.stringify({ auth_token: savedToken })
          })
          .then(res => res.json())
          .then(data => {
            if (mounted) setStatus({ ok: data.ok, msg: data.message });
          })
          .finally(() => {
            if (mounted) setLoading(false);
          });
        }
      })
      .catch(()=>{});
    return () => { mounted = false; };
  }, [zenToken])

  const saveConfig = async (newToken, newFingerprint, newAccount) => {
    await fetch('/api/checker/api/config', {
      method: 'POST',
      headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${zenToken}`
      },
      body: JSON.stringify({ 
          auth_token: newToken.trim(), 
          fingerprint_token: newFingerprint.trim(),
          adobe_account: newAccount.trim() 
      })
    }).catch(()=>{})
  }

  const handleTokenChange = (val) => {
    setToken(val)
    saveConfig(val, fingerprintToken, account)
  }

  const handleFingerprintChange = (val) => {
    setFingerprintToken(val)
    saveConfig(token, val, account)
  }

  const handleAccountChange = (val) => {
    setAccount(val)
    saveConfig(token, fingerprintToken, val)
  }

  const testToken = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/checker/api/test-token', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${zenToken}`
        },
        body: JSON.stringify({ auth_token: token.trim() })
      })
      const data = await res.json()
      setStatus({ ok: data.ok, msg: data.message })
      if (data.ok) toast.success(data.message)
      else toast.error(data.message)
    } catch(e) {
      setStatus({ ok: false, msg: 'Сетевая ошибка' })
    }
    setLoading(false)
  }

  return (
    <Card className="bg-white/70 backdrop-blur-xl border-slate-200 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-500" />
            Токен Авторизации
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
                const script = `(function(){console.log("Ожидаю API-запрос...");let foundTokens={auth:null,fingerprint:null};function handleHeaders(headers){let updated=false;if(headers['authorization']&&!foundTokens.auth){foundTokens.auth=headers['authorization'];updated=true;}if(headers['x-adobe-fingerprint-token']&&!foundTokens.fingerprint){foundTokens.fingerprint=headers['x-adobe-fingerprint-token'];updated=true;}if(updated&&foundTokens.auth&&foundTokens.fingerprint){console.log("=================================");console.log("✅ ТОКЕНЫ ADOBE УСПЕШНО ПЕРЕХВАЧЕНЫ!");console.log("Authorization Token:\\n"+foundTokens.auth);console.log("x-adobe-fingerprint-token:\\n"+foundTokens.fingerprint);console.log("=================================");alert("Токены успешно перехвачены! Посмотрите в консоль.");}}const originalOpen=XMLHttpRequest.prototype.open;const originalSetRequestHeader=XMLHttpRequest.prototype.setRequestHeader;XMLHttpRequest.prototype.open=function(){this._headers={};return originalOpen.apply(this,arguments);};XMLHttpRequest.prototype.setRequestHeader=function(header,value){this._headers[header.toLowerCase()]=value;handleHeaders(this._headers);return originalSetRequestHeader.apply(this,arguments);};const originalFetch=window.fetch;window.fetch=async function(){if(arguments[1]&&arguments[1].headers){let extracted={};if(arguments[1].headers instanceof Headers){extracted['authorization']=arguments[1].headers.get('authorization');extracted['x-adobe-fingerprint-token']=arguments[1].headers.get('x-adobe-fingerprint-token');}else if(Array.isArray(arguments[1].headers)){arguments[1].headers.forEach(h=>extracted[h[0].toLowerCase()]=h[1]);}else{for(let key in arguments[1].headers){extracted[key.toLowerCase()]=arguments[1].headers[key];}}handleHeaders(extracted);}return originalFetch.apply(this,arguments);};})();`;
                navigator.clipboard.writeText(script);
                toast.success("Скрипт перехвата скопирован!");
            }}
          >
            Скрипт (F12)
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 ml-1 uppercase tracking-wider">Аккаунт Adobe</label>
            <div className="relative">
              <User className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
              <Input 
                value={account} 
                onChange={(e) => handleAccountChange(e.target.value)} 
                placeholder="Аккаунт / Email" 
                className="pl-8 text-xs font-medium h-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 ml-1 uppercase tracking-wider">Authorization Token</label>
            <Input 
              value={token} 
              onChange={(e) => handleTokenChange(e.target.value)} 
              placeholder="Bearer eyJhbGciOiJ..." 
              className={`font-mono text-xs h-8 transition-colors ${status ? (status.ok ? 'border-emerald-400 focus-visible:ring-emerald-200 bg-emerald-50/30' : 'border-rose-400 focus-visible:ring-rose-200 bg-rose-50/30') : ''}`}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 ml-1 uppercase tracking-wider">x-adobe-fingerprint-token</label>
            <Input 
              value={fingerprintToken} 
              onChange={(e) => handleFingerprintChange(e.target.value)} 
              placeholder="eyJ6..." 
              className="font-mono text-xs h-8 text-slate-600 bg-slate-50 border-slate-200 focus-visible:ring-slate-300"
            />
          </div>
        </div>
        <Button className="w-full text-xs h-8 shadow-[0_0_10px_rgba(59,130,246,0.3)] hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all bg-blue-600 hover:bg-blue-700 text-white" onClick={testToken} disabled={loading || !token}>
          {loading ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Проверка...</> : 'Проверить токен'}
        </Button>
        {status && (
          <div className={`text-[11px] p-2 rounded bg-slate-50 font-mono border ${status.ok ? 'text-emerald-600 border-emerald-100' : 'text-rose-600 border-rose-100'}`}>
            {status.ok ? '✓' : '✗'} {status.msg}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
