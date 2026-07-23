"use client";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, RefreshCw, CheckCircle2, XCircle, Smartphone, AlertTriangle, Send } from "lucide-react";

export default function AppleRegistrationTab({ token }) {
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [captchaWaiting, setCaptchaWaiting] = useState(false);
  const [captchaSolution, setCaptchaSolution] = useState("");
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);
  const intervalRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Poll status
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const res = await fetch("/api/apple/status");
        const data = await res.json();
        setStatus(data);

        if (data.logs && data.logs.length > 0) {
          setLogs(data.logs);
        }

        if (data.running) {
          setLoading(true);
        } else if (data.total > 0 && !data.running && loading) {
          setLoading(false);
          toast.success(`Регистрация завершена! Успешно: ${data.success}`);
        }
      } catch (err) {
        // Ignore poll errors
      }
    };

    // Check immediately
    pollStatus();
    intervalRef.current = setInterval(pollStatus, 3000);
    return () => clearInterval(intervalRef.current);
  }, [loading]);

  // Poll captcha status
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/apple/captcha-status");
        const data = await res.json();
        if (data.waiting && !captchaWaiting) {
          setCaptchaWaiting(true);
          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ru-RU')}] ⚠️ Капча обнаружена! Введите решение ниже.`]);
          toast.warning("Капча требует решения!");
        } else if (!data.waiting && captchaWaiting) {
          setCaptchaWaiting(false);
        }
      } catch (err) {}
    }, 2000);
    return () => clearInterval(interval);
  }, [loading, captchaWaiting]);

  const handleStart = async (e) => {
    e.preventDefault();
    if (count < 1 || count > 50) return;

    setLoading(true);
    setLogs([`[${new Date().toLocaleTimeString('ru-RU')}] 🚀 Запуск регистрации ${count} аккаунтов...`]);
    setStatus(null);

    try {
      const res = await fetch("/api/apple/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Задача регистрации запущена!");
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ru-RU')}] ✅ Задача отправлена в очередь (Job ID: ${data.jobId})`]);
      } else {
        toast.error(data.error || "Ошибка запуска");
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ru-RU')}] ❌ Ошибка: ${data.error}`]);
        setLoading(false);
      }
    } catch (err) {
      toast.error("Ошибка сети");
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ru-RU')}] ❌ Ошибка сети: ${err.message}`]);
      setLoading(false);
    }
  };

  const handleCaptchaSolve = async () => {
    if (!captchaSolution.trim()) return;
    try {
      const res = await fetch("/api/apple/captcha-solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solution: captchaSolution.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setCaptchaWaiting(false);
        setCaptchaSolution("");
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ru-RU')}] ✅ Капча отправлена`]);
        toast.success("Решение капчи отправлено");
      } else {
        toast.error(data.error || "Ошибка");
      }
    } catch (err) {
      toast.error("Ошибка отправки");
    }
  };

  const handleCancel = async () => {
    try {
      const res = await fetch("/api/apple/cancel", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Регистрация отменена");
        setLoading(false);
        setCaptchaWaiting(false);
      } else {
        toast.error(data.error || "Ошибка отмены");
      }
    } catch (err) {
      toast.error("Ошибка отмены");
    }
  };

  const progressPercent = status && status.total > 0 
    ? Math.round((status.current / status.total) * 100) 
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Регистрация Apple ID
          </CardTitle>
          <CardDescription>Массовая автоматическая регистрация аккаунтов Apple ID через Playwright.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleStart} className="flex flex-col sm:flex-row items-end gap-4">
            <div className="space-y-2 flex-1 sm:max-w-[200px]">
              <label className="text-sm font-medium">Количество аккаунтов</label>
              <Input 
                type="number" 
                min="1" 
                max="50" 
                value={count} 
                onChange={(e) => setCount(parseInt(e.target.value) || 1)} 
                required 
                disabled={loading} 
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button type="submit" disabled={loading} className="flex-1 sm:flex-none">
                {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                {loading ? "Выполняется..." : "Запустить"}
              </Button>
              {loading && (
                <Button type="button" variant="destructive" onClick={handleCancel} className="flex-1 sm:flex-none">
                  <XCircle className="w-4 h-4 mr-2" /> Отменить
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Progress Bar */}
      {status && status.total > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                Прогресс: {status.current} / {status.total}
              </span>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {status.success}
                </span>
                <span className="flex items-center gap-1 text-red-500">
                  <XCircle className="w-3.5 h-3.5" /> {status.failed}
                </span>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${progressPercent}%`,
                  background: status.running 
                    ? 'linear-gradient(90deg, #3b82f6, #6366f1)' 
                    : 'linear-gradient(90deg, #22c55e, #16a34a)'
                }}
              />
            </div>
            {!status.running && status.total > 0 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Регистрация завершена
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Captcha Solver */}
      {captchaWaiting && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Требуется ввод капчи
            </CardTitle>
            <CardDescription>
              На странице Apple обнаружена капча. Откройте изображение капчи и введите текст ниже.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex justify-center bg-white p-2 rounded-md border">
              {/* Add timestamp to prevent browser caching of the captcha image */}
              <img src={`/captcha.jpg?t=${Date.now()}`} alt="Apple Captcha" className="max-h-[100px] object-contain" />
            </div>
            <div className="flex gap-2">
              <Input 
                value={captchaSolution} 
                onChange={(e) => setCaptchaSolution(e.target.value)} 
                placeholder="Введите текст с капчи..." 
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleCaptchaSolve()}
              />
              <Button onClick={handleCaptchaSolve} disabled={!captchaSolution.trim()}>
                <Send className="w-4 h-4 mr-2" /> Отправить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Console Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Лог регистрации</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-zinc-950 text-zinc-100 rounded-lg p-4 font-mono text-xs leading-relaxed max-h-[400px] overflow-y-auto scrollbar-thin">
              {logs.map((line, i) => (
                <div 
                  key={i} 
                  className={`py-0.5 ${
                    line.includes('❌') ? 'text-red-400' :
                    line.includes('✅') ? 'text-green-400' :
                    line.includes('⚠️') ? 'text-amber-400' :
                    line.includes('🚀') ? 'text-blue-400' :
                    'text-zinc-300'
                  }`}
                >
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
