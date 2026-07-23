"use client";
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, RefreshCw, Download, Search, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function AppleAccountsTab({ token }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/apple/accounts");
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data);
      } else {
        setError(data.error || "Failed to fetch accounts");
        toast.error(data.error || "Failed to fetch accounts");
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} скопирован(а)`);
  };

  const handleDownloadTxt = () => {
    if (accounts.length === 0) return;
    const content = accounts
      .map((a) => `${a.email}:${a.password}:${a.phone || "N/A"}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apple-accounts-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      acc.email?.toLowerCase().includes(q) ||
      acc.first_name?.toLowerCase().includes(q) ||
      acc.last_name?.toLowerCase().includes(q) ||
      acc.phone?.includes(q)
    );
  });

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="flex flex-col h-[calc(100vh-140px)]">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Аккаунты Apple ID
            </CardTitle>
            <CardDescription>
              {accounts.length > 0
                ? `Всего ${accounts.length} зарегистрированных аккаунтов`
                : "Список зарегистрированных аккаунтов Apple ID"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadTxt}
              disabled={accounts.length === 0}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Скачать
            </Button>
            <Button onClick={fetchAccounts} disabled={loading} variant="outline" size="sm">
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Обновить
            </Button>
          </div>
        </CardHeader>

        {/* Search */}
        <div className="px-6 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по email, имени или телефону..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

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
                  <TableHead>Email (Apple ID)</TableHead>
                  <TableHead>Пароль</TableHead>
                  <TableHead>Имя</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Дата создания</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-10 text-muted-foreground"
                    >
                      {searchQuery ? "Ничего не найдено" : "Аккаунты не найдены"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{acc.email}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => copyToClipboard(acc.email, "Email")}
                            title="Копировать email"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                            {acc.password}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => copyToClipboard(acc.password, "Пароль")}
                            title="Копировать пароль"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {acc.first_name} {acc.last_name}
                      </TableCell>
                      <TableCell>
                        {acc.phone ? (
                          <Badge
                            variant="outline"
                            className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-normal font-mono text-xs"
                          >
                            {acc.phone}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {acc.created_at
                          ? new Date(acc.created_at).toLocaleString("ru-RU")
                          : "—"}
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
  );
}
