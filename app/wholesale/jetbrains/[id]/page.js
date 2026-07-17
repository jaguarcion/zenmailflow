'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';
import { Lock, Download, Copy, RefreshCw, CheckCircle2, Clock, Box, ArrowLeft, Package } from 'lucide-react';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function WholesaleOrderStatusPage() {
  const { id } = useParams();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [order, setOrder] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Check session via cookie by attempting to fetch the order
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch(`/api/wholesale/jetbrains/order/${id}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIsAuth(true);
          setOrder(data.order);
          setAccounts(data.accounts || []);
        }
      }
    } catch (err) {
      // Not authenticated
    } finally {
      setCheckingAuth(false);
      setLoading(false);
    }
  };

  const fetchOrder = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/wholesale/jetbrains/order/${id}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrder(data.order);
        setAccounts(data.accounts || []);
      } else {
        if (res.status === 401) {
          setIsAuth(false);
          toast.error('Сессия истекла. Войдите снова.');
        }
        if (!data.success && data.error) {
          toast.error(data.error);
        }
      }
    } catch (err) {
      toast.error('Ошибка сети');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuth) {
      const interval = setInterval(() => fetchOrder(false), 10000);
      return () => clearInterval(interval);
    }
  }, [isAuth, id]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (password.length < 1) return;
    try {
      const res = await fetch('/api/wholesale/jetbrains/auth', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        setPassword(''); // Clear from state
        setIsAuth(true);
        toast.success('Успешный вход');
        fetchOrder();
      } else {
        toast.error(data.error || 'Неверный пароль');
      }
    } catch (err) {
      toast.error('Ошибка сети');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано');
  };

  const handleDownload = () => {
    if (!accounts || accounts.length === 0) return;
    const content = accounts.map(a => `${a.email}:${a.password}:${a.license_email || ''}`).join('\n');
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jetbrains-order-${order.woo_order_id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <CardTitle>Доступ для оптовиков</CardTitle>
            <CardDescription>Введите пароль доступа для просмотра заказа</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Пароль</label>
                <Input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full">Войти</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && !order) {
    return <div className="min-h-screen flex items-center justify-center"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!order) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Заказ не найден</p></div>;
  }

  const progress = Math.min(100, Math.round((order.fulfilled / order.quantity) * 100)) || 0;

  return (
    <div className="min-h-screen bg-slate-50 p-4 py-12 flex justify-center">
      <div className="w-full max-w-4xl space-y-6">
        <Link href="/wholesale/jetbrains?tab=list" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к заказам
        </Link>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm border border-blue-100">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Заказ {order.woo_order_id}</h1>
              <p className="text-muted-foreground text-sm">Внутренний ID: {order.id} • Создан: {new Date(order.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex gap-2">
             <Button variant="outline" onClick={() => fetchOrder(true)}>
               <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Обновить
             </Button>
             <Button onClick={handleDownload} disabled={accounts.length === 0} className="bg-primary">
               <Download className="w-4 h-4 mr-2" /> Скачать TXT
             </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Статус выполнения</CardTitle>
            <CardDescription>Прогресс генерации аккаунтов JetBrains</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Статус</span>
                  {order.status === 'pending' && <Badge variant="outline" className="bg-slate-100 text-slate-700 w-fit"><Clock className="w-3 h-3 mr-1"/> Ожидает запуска</Badge>}
                  {order.status === 'processing' && <Badge variant="outline" className="bg-blue-100 text-blue-700 w-fit"><RefreshCw className="w-3 h-3 mr-1 animate-spin"/> В процессе генерации</Badge>}
                  {order.status === 'completed' && <Badge variant="outline" className="bg-green-100 text-green-700 w-fit"><CheckCircle2 className="w-3 h-3 mr-1"/> Завершен</Badge>}
                </div>
              </div>
              <div className="text-right flex flex-col">
                <span className="text-sm text-muted-foreground">Готово</span>
                <span className="text-2xl font-bold font-mono">{order.fulfilled} <span className="text-muted-foreground text-lg">/ {order.quantity}</span></span>
              </div>
            </div>
            <Progress value={progress} className="h-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Готовые аккаунты ({accounts.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md overflow-hidden max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>Email (Личный)</TableHead>
                    <TableHead>Пароль</TableHead>
                    <TableHead>Почта Лицензии (Студенческая)</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                         Пока нет готовых аккаунтов. Пожалуйста, подождите.
                       </TableCell>
                     </TableRow>
                  ) : (
                    accounts.map(acc => (
                      <TableRow key={acc.id}>
                        <TableCell className="font-mono text-sm text-primary font-medium">{acc.email}</TableCell>
                        <TableCell className="font-mono text-sm">
                          <span className="bg-muted px-2 py-1 rounded">{acc.password}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{acc.license_email || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`${acc.email}:${acc.password}:${acc.license_email || ''}`)}>
                            <Copy className="w-4 h-4 mr-2" /> Копировать
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
