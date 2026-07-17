'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { Lock, Package, ArrowRight, RefreshCw, List, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function WholesaleOrderPage() {
  const [password, setPassword] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [wooOrderId, setWooOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedToken = localStorage.getItem('wholesale_token');
    if (savedToken) {
      setPassword(savedToken);
      setIsAuth(true);
      fetchOrders(savedToken);
    }
  }, []);

  const fetchOrders = async (token) => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/wholesale/jetbrains/orders', {
        headers: { 'x-wholesale-auth': token }
      });
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
      }
    } catch (err) {
      toast.error('Не удалось загрузить список заказов');
    } finally {
      setLoadingOrders(false);
    }
  };

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
          fetchOrders(password);
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
        toast.success('Открытие заказа...');
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
            <CardTitle>Оптовые заказы JetBrains</CardTitle>
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
      <div className="w-full max-w-4xl space-y-6">
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Добавить заказ
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="w-4 h-4" /> Мои заказы
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
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
                    <p className="text-xs text-muted-foreground">Система автоматически проверит статус оплаты и количество подписок в этом заказе. Если заказ уже был создан, мы просто откроем его.</p>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                    {loading ? 'Проверка...' : 'Найти или создать заявку'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Список заявок</CardTitle>
                  <CardDescription>Отслеживайте прогресс генерации аккаунтов</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchOrders(password)} disabled={loadingOrders}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingOrders ? 'animate-spin' : ''}`} /> Обновить
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата (ID)</TableHead>
                      <TableHead>Заказ Woo</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Прогресс</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingOrders ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Загрузка...</TableCell>
                      </TableRow>
                    ) : orders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Заказов пока нет</TableCell>
                      </TableRow>
                    ) : (
                      orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div className="font-medium">{new Date(order.created_at).toLocaleDateString('ru-RU')}</div>
                            <div className="text-xs text-muted-foreground">ID: {order.id}</div>
                          </TableCell>
                          <TableCell className="font-bold">#{order.woo_order_id}</TableCell>
                          <TableCell>
                            {order.status === 'completed' ? (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Выполнено</Badge>
                            ) : order.status === 'processing' ? (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">В процессе</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">Ожидает</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{order.fulfilled || 0} из {order.quantity}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => router.push(`/wholesale/jetbrains/${order.id}`)}>
                              Открыть
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
