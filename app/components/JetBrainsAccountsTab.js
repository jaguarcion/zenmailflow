'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function JetBrainsAccountsTab({ token }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/jetbrains/accounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data);
      } else {
        setError(data.error || 'Failed to fetch accounts');
        toast.error(data.error || 'Failed to fetch accounts');
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAccounts();
    }
  }, [token]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} скопирован(а)`);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <Card className="flex flex-col h-[calc(100vh-140px)]">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>Аккаунты JetBrains</CardTitle>
            <CardDescription>
              Список сгенерированных аккаунтов с лицензией
            </CardDescription>
          </div>
          <Button onClick={fetchAccounts} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </CardHeader>
        
        {error && (
          <div className="px-6 pb-2">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
              {error}
            </div>
          </div>
        )}

        <CardContent className="flex-1 overflow-hidden flex flex-col p-0 px-6 pb-6">
          <div className="rounded-md border flex-1 overflow-auto scrollbar-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead>Студ. почта (Login)</TableHead>
                  <TableHead>Пароль</TableHead>
                  <TableHead>Доп. почта (Pro100)</TableHead>
                  <TableHead>Дата создания</TableHead>
                  <TableHead>Истекает</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px] rounded-full" /></TableCell>
                    </TableRow>
                  ))
                ) : accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      Аккаунты не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.entries(
                    accounts.reduce((acc, curr) => {
                      const key = curr.woo_order_id ? `Заказ #${curr.woo_order_id}` : 'Активация (Manual)';
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(curr);
                      return acc;
                    }, {})
                  ).map(([groupName, groupAccounts]) => (
                    <React.Fragment key={groupName}>
                      <TableRow className="bg-slate-100/50 hover:bg-slate-100/50">
                        <TableCell colSpan={5} className="font-semibold text-slate-700 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            {groupName} <span className="text-muted-foreground font-normal text-xs ml-2">({groupAccounts.length} аккаунтов)</span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {groupAccounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {acc.license_email}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => copyToClipboard(acc.license_email, 'Студ. почта')}
                            title="Копировать почту"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{acc.password}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => copyToClipboard(acc.password, 'Пароль')}
                            title="Копировать пароль"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-6 px-2 text-xs ml-2 whitespace-nowrap"
                            onClick={() => copyToClipboard(`${acc.license_email}:${acc.password}`, 'Логин:Пароль')}
                            title="Копировать логин:пароль"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Всё вместе
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <div className="flex items-center gap-2">
                          {acc.email}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => copyToClipboard(acc.email, 'Доп. почта')}
                            title="Копировать доп. почту"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(acc.created_at).toLocaleString('ru-RU')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/20 font-normal">
                          {new Date(acc.expires_at).toLocaleDateString('ru-RU')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
