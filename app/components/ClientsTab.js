"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Copy, Link as LinkIcon, Pencil, Check, ChevronsUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatDate } from "@/lib/utils";
import { ArrowUpDown } from "lucide-react";

function AssignAccountCombobox({ availableAccounts, onAssign }) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-8 text-xs px-2"
                >
                    <span className="truncate">Привязать аккаунт</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                    <CommandInput placeholder="Поиск по email..." className="h-9 text-xs" />
                    <CommandList>
                        <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">Не найдено свободных аккаунтов</CommandEmpty>
                        <CommandGroup>
                            {availableAccounts.map((acc) => (
                                <CommandItem
                                    key={acc.id}
                                    value={acc.email}
                                    onSelect={() => {
                                        onAssign(acc.id);
                                        setOpen(false);
                                    }}
                                    className="text-xs cursor-pointer"
                                >
                                    <span className="truncate">{acc.email}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default function ClientsTab({ token, clients, onFetchClients }) {
    const [form, setForm] = useState({ email: '', telegram: '', subscription_starts_at: '', subscription_ends_at: '' });
    const [loading, setLoading] = useState(false);
    const [availableAccounts, setAvailableAccounts] = useState([]);
    const [editClient, setEditClient] = useState(null);
    const [editForm, setEditForm] = useState({ email: '', telegram: '', subscription_starts_at: '', subscription_ends_at: '' });
    const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedClients = [...clients].sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (sortConfig.key === 'subscription_ends_at') {
            if (!valA && !valB) return 0;
            if (!valA) return 1;
            if (!valB) return -1;
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        } else {
            valA = valA || '';
            valB = valB || '';
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const fetchAvailableAccounts = async () => {
        try {
            const res = await fetch("/api/adobe", { headers: { "Authorization": `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) {
                // Filter accounts that are active and not currently assigned to a real client
                setAvailableAccounts(data.data.filter(acc => acc.status === 'active' && (!acc.assigned_client_id || acc.assigned_client_id === -1)));
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchAvailableAccounts();
    }, [token, clients]); // Refetch when clients change so the list is updated

    const handleAssignAdobe = async (clientId, adobeId) => {
        try {
            const res = await fetch(`/api/adobe`, {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ id: adobeId, client_id: clientId, action: "assign" })
            });
            if (res.ok) {
                toast.success("Аккаунт успешно привязан");
                onFetchClients();
                fetchAvailableAccounts();
            } else {
                toast.error("Ошибка при привязке");
            }
        } catch (e) {
            toast.error("Ошибка сети");
        }
    };

    const copyBotLink = (botToken) => {
        const link = `https://t.me/zenmailflow_bot?start=${botToken}`;
        navigator.clipboard.writeText(link);
        toast.success("Ссылка на бота скопирована!");
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/clients", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                toast.success("Клиент добавлен");
                setForm({ email: '', telegram: '', subscription_starts_at: '', subscription_ends_at: '' });
                onFetchClients();
            } else {
                const err = await res.json();
                toast.error(err.error || "Ошибка при добавлении");
            }
        } catch (e) {
            toast.error("Ошибка сети");
        }
        setLoading(false);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/clients", {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ id: editClient.id, ...editForm })
            });
            if (res.ok) {
                toast.success("Данные клиента обновлены");
                setEditClient(null);
                onFetchClients();
            } else {
                toast.error("Ошибка при обновлении");
            }
        } catch (e) {
            toast.error("Ошибка сети");
        }
        setLoading(false);
    };

    const openEditModal = (client) => {
        setEditClient(client);
        setEditForm({
            email: client.email || '',
            telegram: client.telegram || client.telegram_username ? `@${client.telegram_username}` : '',
            subscription_starts_at: client.subscription_starts_at || '',
            subscription_ends_at: client.subscription_ends_at || ''
        });
    };

    const addDaysToSubscription = (days) => {
        const currentDateStr = editForm.subscription_ends_at;
        const d = currentDateStr ? new Date(currentDateStr) : new Date();
        d.setDate(d.getDate() + days);
        setEditForm({ ...editForm, subscription_ends_at: d.toISOString().split('T')[0] });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Создание клиента</CardTitle>
                    <CardDescription>Добавление нового профиля клиента</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAdd} className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="space-y-2 flex-1">
                            <label className="text-sm font-medium">Email</label>
                            <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="client@test.com" />
                        </div>
                        <div className="space-y-2 flex-1">
                            <label className="text-sm font-medium">Telegram</label>
                            <Input type="text" value={form.telegram} onChange={e => setForm({...form, telegram: e.target.value})} placeholder="@username" />
                        </div>
                        <div className="space-y-2 flex-1">
                            <label className="text-sm font-medium">Подписка до</label>
                            <Input type="date" value={form.subscription_ends_at} onChange={e => setForm({...form, subscription_ends_at: e.target.value})} />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                            <UserPlus className="w-4 h-4 mr-2" />
                            {loading ? 'Создание...' : 'Добавить клиента'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>База Клиентов ({clients.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border h-[500px] overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('email')}>
                                        <div className="flex items-center gap-1">Email (ID) <ArrowUpDown className="w-3 h-3" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('telegram')}>
                                        <div className="flex items-center gap-1">Telegram Бот <ArrowUpDown className="w-3 h-3" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('subscription_ends_at')}>
                                        <div className="flex items-center gap-1">Подписка <ArrowUpDown className="w-3 h-3" /></div>
                                    </TableHead>
                                    <TableHead>Осталось дней</TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('adobe_account_email')}>
                                        <div className="flex items-center gap-1">Привязка Adobe <ArrowUpDown className="w-3 h-3" /></div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Нет клиентов</TableCell>
                                    </TableRow>
                                )}
                                {sortedClients.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell>
                                            <div className="font-medium text-foreground flex items-center gap-2">
                                                {c.email || <span className="text-muted-foreground italic">Без Email</span>}
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted" onClick={() => openEditModal(c)}>
                                                    <Pencil className="w-3 h-3 text-muted-foreground" />
                                                </Button>
                                            </div>
                                            <div className="text-xs text-muted-foreground">ID: {c.id}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">
                                                {[c.telegram_first_name, c.telegram_last_name].filter(Boolean).join(' ') || c.telegram_username || c.telegram || '-'}
                                            </div>
                                            {(c.telegram_username || c.telegram) && (
                                                <div className="text-xs text-muted-foreground">
                                                    <a href={`https://t.me/${(c.telegram_username || c.telegram).replace('@', '')}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                                                        {c.telegram_username ? `@${c.telegram_username}` : c.telegram}
                                                    </a>
                                                </div>
                                            )}
                                            {c.telegram_chat_id ? (
                                                <span className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Подключен
                                                </span>
                                            ) : c.bot_link_token ? (
                                                <div 
                                                    className="text-xs text-blue-500 cursor-pointer flex items-center gap-1 hover:underline mt-1"
                                                    onClick={() => copyBotLink(c.bot_link_token)}
                                                >
                                                    <LinkIcon className="w-3 h-3" /> Пригласить
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground mt-1 block">Нет ссылки</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs space-y-1">
                                                {c.subscription_starts_at && <div className="font-bold">С: {formatDate(c.subscription_starts_at)}</div>}
                                                <div className="font-medium">До: {c.subscription_ends_at ? formatDate(c.subscription_ends_at) : 'Бессрочно'}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {(() => {
                                                if (!c.subscription_ends_at) return <span className="text-xs text-muted-foreground">Бессрочно</span>;
                                                const diff = Math.ceil((new Date(c.subscription_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
                                                return <Badge variant="outline" className={`text-xs ${diff <= 3 ? "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20" : diff <= 15 ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20" : "bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20"}`}>{diff < 0 ? 'Закончилась' : `${diff} дн.`}</Badge>;
                                            })()}
                                        </TableCell>
                                        <TableCell>
                                            {c.adobe_account_email ? (
                                                <div className="space-y-1">
                                                    <div className="font-medium text-primary text-sm flex justify-between items-center">
                                                        {c.adobe_account_email}
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleAssignAdobe(null, c.adobe_account_id)}
                                                        >
                                                            Отвязать
                                                        </Button>
                                                    </div>
                                                    <Badge variant={c.adobe_account_status === 'active' ? 'outline' : 'destructive'} className={c.adobe_account_status === 'active' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20 text-xs' : 'text-xs'}>
                                                        {c.adobe_account_status === 'active' ? 'Активный' : c.adobe_account_status === 'banned' ? 'Забанен' : c.adobe_account_status}
                                                    </Badge>
                                                </div>
                                            ) : (
                                                <AssignAccountCombobox 
                                                    availableAccounts={availableAccounts} 
                                                    onAssign={(accId) => handleAssignAdobe(c.id, accId)} 
                                                />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!editClient} onOpenChange={(open) => !open && setEditClient(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактирование клиента (ID: {editClient?.id})</DialogTitle>
                    </DialogHeader>
                    {editClient && (
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email</label>
                                <Input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} placeholder="client@test.com" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Telegram</label>
                                <Input type="text" value={editForm.telegram} onChange={e => setEditForm({...editForm, telegram: e.target.value})} placeholder="@username" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Дата начала подписки</label>
                                <Input type="date" value={editForm.subscription_starts_at} onChange={e => setEditForm({...editForm, subscription_starts_at: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Подписка до</label>
                                <Input type="date" value={editForm.subscription_ends_at} onChange={e => setEditForm({...editForm, subscription_ends_at: e.target.value})} />
                                <div className="flex gap-2 pt-1">
                                    <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => addDaysToSubscription(1)}>+1 день</Button>
                                    <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => addDaysToSubscription(2)}>+2 дня</Button>
                                    <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => addDaysToSubscription(3)}>+3 дня</Button>
                                </div>
                            </div>
                            <Button type="submit" disabled={loading} className="w-full">
                                {loading ? 'Сохранение...' : 'Сохранить изменения'}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
