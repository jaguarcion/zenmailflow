'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { Lock, Package, ArrowRight } from 'lucide-react';

export default function WholesaleOrderPage() {
  const [password, setPassword] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [wooOrderId, setWooOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedToken = localStorage.getItem('wholesale_token');
    if (savedToken) {
      setPassword(savedToken);
      setIsAuth(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (password.length > 3) {
      try {
        const res = await fetch('/api/wholesale/jetbrains/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('wholesale_token', password);
          setIsAuth(true);
          toast.success('Успешный вход');
        } else {
          toast.error(data.error || 'Неверный пароль');
        }
      } catch (err) {
        toast.error('Ошибка сети');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!wooOrderId) return toast.error('Укажите номер заказа');

    setLoading(true);
    try {
      const res = await fetch('/api/wholesale/jetbrains/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wholesale-auth': password
        },
        body: JSON.stringify({ wooOrderId })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Заказ успешно создан!');
        router.push(`/wholesale/jetbrains/${data.orderId}`);
      } else {
        if (res.status === 401) {
          setIsAuth(false);
          localStorage.removeItem('wholesale_token');
        }
        toast.error(data.error || 'Ошибка создания заказа');
      }
    } catch (err) {
      toast.error('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <CardTitle>Доступ для оптовиков</CardTitle>
            <CardDescription>Введите пароль доступа для создания заявок</CardDescription>
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
                />
              </div>
              <Button type="submit" className="w-full">Войти</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 py-12 flex justify-center">
      <Card className="w-full max-w-lg h-fit">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Новая заявка на подписки</CardTitle>
              <CardDescription>Оформление заказа JetBrains (Опт)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Номер заказа WooCommerce</label>
              <Input 
                value={wooOrderId}
                onChange={(e) => setWooOrderId(e.target.value)}
                placeholder="Например: #10452"
                required
              />
              <p className="text-xs text-muted-foreground">Система автоматически проверит статус оплаты и количество подписок в этом заказе.</p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Создание...' : (
                <>Отправить заявку <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
