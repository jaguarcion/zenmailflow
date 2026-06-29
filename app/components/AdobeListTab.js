"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ExternalLink, Search, RefreshCw, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function AdobeListTab({ token, clients, onFetchClients }) {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);
    const [checkingIds, setCheckingIds] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [sortConfig, setSortConfig] = useState({ key: 'email', direction: 'asc' });

    const fetchAccounts = async () => {
        try {
            const res = await fetch("/api/adobe", { headers: { "Authorization": `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) {
                setAccounts(data.data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleDelete = async (id) => {
        if (!confirm('Точно удалить?')) return;
        try {
            await fetch(`/api/adobe?id=${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
            fetchAccounts();
            onFetchClients();
        } catch (e) {
            console.error(e);
        }
    };

    const handleAssign = async (id, status) => {
        let client_id = status === 'busy' ? -1 : null;
        try {
            await fetch(`/api/adobe`, {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ id, client_id, action: "assign" })
            });
            fetchAccounts();
            onFetchClients();
        } catch (e) {
            console.error(e);
        }
    };

    const handleCommentBlur = async (id, comment) => {
        try {
            await fetch(`/api/adobe`, {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ id, action: "comment", comment })
            });
            setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, comment } : acc));
            toast.success("Комментарий сохранен");
        } catch (e) {
            console.error(e);
            toast.error("Ошибка сохранения комментария");
        }
    };

    const handleCheckStatus = async (idsToCheck = null) => {
        const ids = idsToCheck || Array.from(selectedIds);
        if (ids.length === 0) return;
        
        setChecking(true);
        const toastId = toast.loading(`Проверка статусов (0/${ids.length})...`);
        
        setCheckingIds(prev => new Set([...prev, ...ids]));
        
        let completed = 0;

        for (const id of ids) {
            try {
                const res = await fetch("/api/adobe/check", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ accountIds: [id] })
                });
                const data = await res.json();
                if (data.success && data.results && data.results.length > 0) {
                    setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, status: data.results[0].status } : acc));
                }
            } catch (e) {
                console.error(e);
            }
            completed++;
            toast.loading(`Проверка статусов (${completed}/${ids.length})...`, { id: toastId });
            
            setCheckingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        }
        
        toast.success("Проверка завершена", { id: toastId });
        fetchAccounts();
        setSelectedIds(new Set());
        setChecking(false);
    };

    const toggleSelect = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredAccounts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredAccounts.map(a => a.id)));
        }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredAccounts = accounts.filter(acc => 
        acc.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (acc.client_telegram && acc.client_telegram.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const sortedAccounts = [...filteredAccounts].sort((a, b) => {
        let valA = a[sortConfig.key] || '';
        let valB = b[sortConfig.key] || '';
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <div className="space-y-6 h-full flex flex-col">
            <Card className="flex flex-col h-[calc(100vh-140px)]">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div className="flex items-center gap-4">
                        <CardTitle>Пул аккаунтов Adobe ({filteredAccounts.length})</CardTitle>
                        {selectedIds.size > 0 && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleCheckStatus()}
                                disabled={checking}
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
                                Проверить выбранные ({selectedIds.size})
                            </Button>
                        )}
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Поиск по email..."
                            className="pl-8 h-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col p-0 px-6 pb-6">
                    <div className="rounded-md border flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox 
                                            checked={filteredAccounts.length > 0 && selectedIds.size === filteredAccounts.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('email')}>
                                        <div className="flex items-center gap-1">Email <ArrowUpDown className="w-3 h-3" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                                        <div className="flex items-center gap-1">Статус <ArrowUpDown className="w-3 h-3" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('assigned_client_id')}>
                                        <div className="flex items-center gap-1">Привязка <ArrowUpDown className="w-3 h-3" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('client_telegram')}>
                                        <div className="flex items-center gap-1">Клиент <ArrowUpDown className="w-3 h-3" /></div>
                                    </TableHead>
                                    <TableHead>Комментарий</TableHead>
                                    <TableHead className="text-right">Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAccounts.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Нет аккаунтов</TableCell>
                                    </TableRow>
                                )}
                                {sortedAccounts.map(acc => (
                                    <TableRow key={acc.id} className={selectedIds.has(acc.id) ? 'bg-muted/50' : ''}>
                                        <TableCell>
                                            <Checkbox 
                                                checked={selectedIds.has(acc.id)}
                                                onCheckedChange={() => toggleSelect(acc.id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{acc.email}</div>
                                            <a href={`/client/adobe/${acc.access_token}`} target="_blank" className="text-xs text-primary flex items-center gap-1 hover:underline mt-1">
                                                Ссылка <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={acc.status === 'active' ? 'outline' : 'destructive'} className={acc.status === 'active' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : ''}>
                                                {acc.status === 'active' ? 'Активный' : acc.status === 'banned' ? 'Забанен' : acc.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Select 
                                                value={acc.assigned_client_id ? "busy" : "free"} 
                                                onValueChange={(val) => handleAssign(acc.id, val)}
                                            >
                                                <SelectTrigger className={`w-[130px] h-8 text-xs ${acc.assigned_client_id ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"}`}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="free">Свободен</SelectItem>
                                                    <SelectItem value="busy">Занят</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            {acc.assigned_client_id ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-medium text-sm text-slate-800">
                                                        {[acc.client_first_name, acc.client_last_name].filter(Boolean).join(" ") || "Без имени"}
                                                    </span>
                                                    {acc.client_telegram ? (
                                                        <a href={`https://t.me/${acc.client_telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                                                            {acc.client_telegram.startsWith('@') ? acc.client_telegram : `@${acc.client_telegram}`}
                                                        </a>
                                                    ) : acc.client_email ? (
                                                        <span className="text-xs text-slate-500">{acc.client_email}</span>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                defaultValue={acc.comment || ""}
                                                onBlur={(e) => {
                                                    if (e.target.value !== (acc.comment || "")) {
                                                        handleCommentBlur(acc.id, e.target.value);
                                                    }
                                                }}
                                                className="h-8 text-xs w-[150px] bg-slate-50 border-slate-200"
                                                placeholder="Комментарий..."
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => handleCheckStatus([acc.id])} disabled={checkingIds.has(acc.id)} title="Проверить статус" className="h-8 w-8 p-0">
                                                    <RefreshCw className={`w-4 h-4 ${checkingIds.has(acc.id) ? 'animate-spin text-blue-500' : ''}`} />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
