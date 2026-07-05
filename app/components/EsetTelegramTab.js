"use client";
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Key, Clock, Bot, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";

export default function EsetTelegramTab({ token }) {
    const [stats, setStats] = useState({ totalUsers: 0, todayUsers: 0, totalKeys: 0 });
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/eset/telegram", {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setStats(data.stats);
                setHistory(data.history);
            }
        } catch (err) {
            console.error("Failed to fetch telegram stats", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalUsers}</div>
                        <p className="text-xs text-muted-foreground">
                            Зарегистрировано в боте
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Новых за сегодня</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{stats.todayUsers}</div>
                        <p className="text-xs text-muted-foreground">
                            С начала суток
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Выдано ключей</CardTitle>
                        <Key className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalKeys}</div>
                        <p className="text-xs text-muted-foreground">
                            Через Telegram бота
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-4 border-b">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2"><Bot className="w-5 h-5 text-sky-500" /> История Telegram Бота</CardTitle>
                        <CardDescription>Последние выдачи ключей пользователям через бота.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Обновить
                    </Button>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="rounded-md border shadow-sm h-[400px] overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                <TableRow>
                                    <TableHead>Дата и Время</TableHead>
                                    <TableHead>Пользователь</TableHead>
                                    <TableHead>Сгенерированный ключ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-[120px] rounded" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : history.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-20 text-muted-foreground">
                                            <Bot className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                                            <p>Никто еще не получал ключи через бота.</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    history.map((task) => {
                                        let items = [];
                                        try { items = JSON.parse(task.items_json || '[]'); } catch {}
                                        const key = items.length > 0 ? items[0].licenseKey : '—';
                                        
                                        return (
                                            <TableRow key={task.id} className="hover:bg-muted/50">
                                                <TableCell>
                                                    <div className="font-medium text-sm flex items-center gap-2">
                                                        <Clock className="w-3 h-3 text-muted-foreground" />
                                                        {new Date(task.created_at).toLocaleString()}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-medium px-2 py-1 rounded bg-sky-100 text-sky-700 text-xs">
                                                        {task.user_info || 'Unknown User'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-mono font-bold text-primary text-sm">{key}</span>
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
