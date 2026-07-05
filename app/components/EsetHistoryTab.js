"use client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Download, History, ChevronDown, ChevronRight, CheckCircle2, Clock, RefreshCw } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

export default function EsetHistoryTab({ token }) {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedTasks, setExpandedTasks] = useState(new Set());

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const fetchTasks = async (pageNum = 1, append = false) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/eset/tasks?page=${pageNum}`, { headers: { 'Authorization': `Bearer ${token}` } });
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
            console.error("Failed to fetch eset tasks", err);
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

    const toggleExpand = (id) => {
        const newExpanded = new Set(expandedTasks);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedTasks(newExpanded);
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!confirm("Удалить эту задачу генерации?")) return;
        try {
            const res = await fetch(`/api/eset/tasks?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) fetchTasks();
        } catch (err) {
            toast.error("Ошибка при удалении");
        }
    };

    const handleClearAll = async () => {
        if (!confirm("Вы уверены, что хотите удалить ВСЮ историю генераций ESET?")) return;
        try {
            const res = await fetch(`/api/eset/tasks?id=all`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) fetchTasks();
        } catch (err) {
            toast.error("Ошибка при удалении истории");
        }
    };

    const handleDownloadTxt = (taskItems, e) => {
        if (e) e.stopPropagation();
        if (!taskItems || taskItems.length === 0) return;
        
        let items = [];
        try {
            items = typeof taskItems === 'string' ? JSON.parse(taskItems) : taskItems;
        } catch { return; }

        if (items.length === 0) return;

        const content = items.map(item => `${item.licenseKey}`).join("\n");
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `eset-keys-${new Date().toISOString().split("T")[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-4 border-b">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2"><History className="w-5 h-5 text-primary" /> История генераций</CardTitle>
                    <CardDescription>Архив всех пачек сгенерированных ключей ESET.</CardDescription>
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
                                        <p>История генераций пуста.</p>
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
                                                        {task.source === 'api' && (
                                                            <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shadow-sm">
                                                                API
                                                            </span>
                                                        )}
                                                        {task.source === 'api-telegram' && (
                                                            <span className="bg-sky-100 text-sky-700 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shadow-sm">
                                                                API-TELEGRAM
                                                            </span>
                                                        )}
                                                        {task.source === 'api-telegram-autopost' && (
                                                            <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shadow-sm">
                                                                API-TELEGRAM-AUTO
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-mono">{task.id.split('-')[0]}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {task.status === 'processing' && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full inline-flex items-center"><RefreshCw className="w-3 h-3 mr-1 animate-spin"/> В процессе</span>}
                                                    {task.status === 'success' && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full inline-flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> Завершено</span>}
                                                    {task.status === 'cancelled' && <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full inline-flex items-center"><Clock className="w-3 h-3 mr-1"/> Отменена</span>}
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
                                                        <Button variant="ghost" size="sm" onClick={(e) => handleDownloadTxt(items, e)} disabled={items.length === 0} className="h-8 w-8 p-0" title="Скачать ключи txt">
                                                            <Download className="w-4 h-4 text-primary" />
                                                        </Button>
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
                                                                <div className="text-center text-sm text-muted-foreground py-2">Нет сгенерированных ключей в этой задаче</div>
                                                            ) : (
                                                                <div className="max-h-[300px] overflow-y-auto border rounded bg-background">
                                                                    <Table>
                                                                        <TableHeader className="bg-muted/40 sticky top-0">
                                                                            <TableRow>
                                                                                <TableHead className="py-2 text-xs">Email</TableHead>
                                                                                <TableHead className="py-2 text-xs">Pass</TableHead>
                                                                                <TableHead className="py-2 text-xs">Product</TableHead>
                                                                                <TableHead className="py-2 text-xs">Key</TableHead>
                                                                                <TableHead className="py-2 text-xs text-right">Expires</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {items.map((item, i) => (
                                                                                <TableRow key={i}>
                                                                                    <TableCell className="py-2 text-xs font-mono">{item.email}</TableCell>
                                                                                    <TableCell className="py-2 text-xs font-mono text-muted-foreground">{item.accountPassword}</TableCell>
                                                                                    <TableCell className="py-2 text-xs font-medium">{item.productName}</TableCell>
                                                                                    <TableCell className="py-2 text-sm font-mono font-bold text-primary">{item.licenseKey}</TableCell>
                                                                                    <TableCell className="py-2 text-xs text-right text-muted-foreground">{item.expirationDate?.split('T')[0]}</TableCell>
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
