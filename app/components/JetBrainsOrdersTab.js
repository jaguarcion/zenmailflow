'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Play, Trash2, CheckCircle2, Clock, Download, Package } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function JetBrainsOrdersTab({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchOrders = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await fetch('/api/jetbrains/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
      }
    } catch (err) {
      toast.error('Ошибка при загрузке заказов');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchOrders();
      const interval = setInterval(() => fetchOrders(false), 10000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const handleFulfill = async (orderId) => {
    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/jetbrains/orders/${orderId}/fulfill`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(`Успешно! Отправлено в генерацию: ${data.enqueued} шт.`);
        fetchOrders();
      } else {
        toast.error(data.error || 'Ошибка при запуске заказа');
      }
    } catch (err) {
      toast.error('Ошибка сети');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async (orderId, wooId) => {
    try {
      const res = await fetch(`/api/jetbrains/orders/${orderId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.accounts.length > 0) {
        const content = data.accounts.map(a => `${a.email}:${a.password}:${a.license_email || ''}`).join('\n');
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `jetbrains-order-${wooId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        toast.error('Нет готовых аккаунтов для скачивания');
      }
    } catch (err) {
      toast.error('Ошибка скачивания');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-slate-100 text-slate-700 w-fit"><Clock className="w-3 h-3 mr-1"/> Ожидает запуска</Badge>;
      case 'processing': return <Badge variant="outline" className="bg-blue-100 text-blue-700 w-fit"><RefreshCw className="w-3 h-3 mr-1 animate-spin"/> Выполняется</Badge>;
      case 'completed': return <Badge variant="outline" className="bg-green-100 text-green-700 w-fit"><CheckCircle2 className="w-3 h-3 mr-1"/> Завершен</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <Card className="flex flex-col h-[calc(100vh-140px)]">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>Оптовые заказы</CardTitle>
            <CardDescription>
              Заявки от оптовиков на массовую генерацию аккаунтов JetBrains
            </CardDescription>
          </div>
          <Button onClick={() => fetchOrders(true)} disabled={loading} variant="outline" size="icon">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden flex flex-col p-0 px-6 pb-6">
          <div className="rounded-md border flex-1 overflow-auto scrollbar-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead>Дата (ID)</TableHead>
                  <TableHead>Заказ Woo</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Прогресс (Сделано / Всего)</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && orders.length === 0 ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[100px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 float-right" /></TableCell>
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      Заказов пока нет
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => {
                    const progress = Math.min(100, Math.round((order.fulfilled / order.quantity) * 100)) || 0;
                    const isFullyFulfilled = order.fulfilled >= order.quantity;

                    return (
                      <TableRow key={order.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="font-medium text-sm">
                            {new Date(order.created_at).toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">ID: {order.id}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-primary font-bold">#{order.woo_order_id}</div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(order.status)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2 w-full max-w-[200px]">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-green-600 font-bold">{order.fulfilled}</span>
                              <span className="text-muted-foreground">из {order.quantity}</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {order.status !== 'completed' && !isFullyFulfilled && (
                              <Button 
                                variant="default" 
                                size="sm" 
                                className="h-8 bg-blue-600 hover:bg-blue-700" 
                                disabled={actionLoading === order.id}
                                onClick={() => handleFulfill(order.id)}
                              >
                                {actionLoading === order.id ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                                Выполнить
                              </Button>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8" 
                              disabled={order.fulfilled === 0}
                              onClick={() => handleDownload(order.id, order.woo_order_id)}
                              title="Скачать TXT с аккаунтами"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
