"use client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, History, ChevronDown, ChevronRight, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AutodeskHistoryTab({ token }) {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedTasks, setExpandedTasks] = useState(new Set());
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const fetchTasks = async (pageNum = 1, append = false) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/autodesk/tasks?page=${pageNum}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) {
                if (append) {
                    setTasks(prev => [...prev, ...data.tasks]);
                } else {
                    setTasks(data.tasks);
                }
                setHasMore(data.hasMore);
                setPage(pageNum);
            }
        } catch (err) {
            console.error("Failed to fetch autodesk tasks", err);
        } finally {
            setLoading(false);
        }
    };

    const handleScroll = (e) => {
        const { scrollTop, clientHeight, scrollHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight * 1.5 && !loading && hasMore) {
            fetchTasks(page + 1, true);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [token]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetch(`/api/autodesk/tasks?page=1`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.tasks) {
                        setTasks(prev => {
                            if (page === 1) return data.tasks;
                            const newTasks = [...prev];
                            let added = false;
                            data.tasks.forEach(updatedTask => {
                                const idx = newTasks.findIndex(t => t.id === updatedTask.id);
                                if (idx !== -1) {
                                    newTasks[idx] = updatedTask;
                                } else {
                                    newTasks.unshift(updatedTask);
                                    added = true;
                                }
                            });
                            if (added) {
                                newTasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                            }
                            return newTasks;
                        });
                    }
                })
                .catch(err => console.error("Auto-refresh failed", err));
        }, 10000);

        return () => clearInterval(interval);
    }, [page, token]);

    const toggleExpand = (id) => {
        const newExpanded = new Set(expandedTasks);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedTasks(newExpanded);
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!confirm("Удалить эту задачу инвайтов?")) return;
        try {
            const res = await fetch(`/api/autodesk/tasks?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) fetchTasks();
        } catch (err) {
            toast.error("Ошибка при удалении");
        }
    };

    const handleClearAll = async () => {
        if (!confirm("Вы уверены, что хотите удалить ВСЮ историю инвайтов Autodesk?")) return;
        try {
            const res = await fetch(`/api/autodesk/tasks?id=all`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) fetchTasks();
        } catch (err) {
            toast.error("Ошибка при удалении истории");
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-4 border-b">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2"><History className="w-5 h-5 text-primary" /> История инвайтов</CardTitle>
                    <CardDescription>Архив фоновых задач по добавлению пользователей в Autodesk.</CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => fetchTasks(1, false)} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading && page === 1 ? 'animate-spin' : ''}`} /> Обновить
                    </Button>
                    {tasks.length > 0 && (
                        <Button variant="destructive" size="sm" onClick={handleClearAll} className="bg-red-900 hover:bg-red-800">
                            Очистить историю
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="rounded-md border shadow-sm h-[600px] overflow-auto" onScroll={handleScroll}>
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[40px]"></TableHead>
                                <TableHead>Дата (ID)</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead>Успешно / Ошибок / Всего</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && page === 1 ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-[100px] rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-16 float-right" /></TableCell>
                                    </TableRow>
                                ))
                            ) : tasks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                                        <History className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                                        <p>История пуста.</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                tasks.map((task) => {
                                    const isExpanded = expandedTasks.has(task.id);
                                    let items = [];
                                    try { items = JSON.parse(task.items_json || '[]'); } catch {}

                                    return (
                                        <React.Fragment key={task.id}>
                                            <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(task.id)}>
                                                <TableCell>
                                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-sm flex items-center gap-2">
                                                        {new Date(task.created_at).toLocaleString()}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-mono">{task.id.split('-')[0]}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {task.status === 'processing' && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full inline-flex items-center"><RefreshCw className="w-3 h-3 mr-1 animate-spin"/> В процессе</span>}
                                                    {task.status === 'completed' && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full inline-flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> Завершено</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 font-mono text-sm">
                                                        <span className="text-green-600 font-bold">{task.success}</span> /
                                                        <span className="text-red-600 font-bold">{task.error}</span> /
                                                        <span className="text-foreground">{task.total}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="sm" onClick={(e) => handleDelete(task.id, e)} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0">
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && (
                                                <TableRow className="bg-muted/10">
                                                    <TableCell colSpan={5} className="p-0 border-b">
                                                        <div className="p-4 bg-muted/20 inset-shadow-sm">
                                                            {items.length === 0 ? (
                                                                <div className="text-center text-sm text-muted-foreground py-2">Нет аккаунтов в этой задаче</div>
                                                            ) : (
                                                                <div className="max-h-[300px] overflow-y-auto border rounded bg-background">
                                                                    <Table>
                                                                        <TableHeader className="bg-muted/40 sticky top-0">
                                                                            <TableRow>
                                                                                <TableHead className="py-2 text-xs">Email</TableHead>
                                                                                <TableHead className="py-2 text-xs">Имя</TableHead>
                                                                                <TableHead className="py-2 text-xs text-right">Статус</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {items.map((item, i) => (
                                                                                <TableRow key={i}>
                                                                                    <TableCell className="py-2 text-xs font-mono">{item.email}</TableCell>
                                                                                    <TableCell className="py-2 text-xs text-muted-foreground">{item.firstName} {item.lastName}</TableCell>
                                                                                    <TableCell className="py-2 text-xs text-right">
                                                                                        {item.status === 'success' ? (
                                                                                            <span className="text-green-600 font-medium inline-flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> Успешно</span>
                                                                                        ) : item.status === 'error' || item.status === 'failed' ? (
                                                                                            <span className="text-red-600 font-medium inline-flex items-center"><XCircle className="w-3 h-3 mr-1"/> Ошибка</span>
                                                                                        ) : (
                                                                                            <span className="text-muted-foreground font-medium">{item.status}</span>
                                                                                        )}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                            {loading && page > 1 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-4">
                                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
