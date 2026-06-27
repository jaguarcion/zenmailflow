"use client";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus } from "lucide-react";

export default function ClientsTab({ token, clients, onFetchClients }) {
    const [form, setForm] = useState({ email: '', telegram: '', subscription_ends_at: '' });
    const [loading, setLoading] = useState(false);

    const handleAdd = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/clients", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (data.success) {
                setForm({ email: '', telegram: '', subscription_ends_at: '' });
                onFetchClients();
            } else {
                alert(data.error);
            }
        } catch (e) {
            alert("Error");
        }
        setLoading(false);
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
                                    <TableHead>Email (ID)</TableHead>
                                    <TableHead>Telegram</TableHead>
                                    <TableHead>Подписка</TableHead>
                                    <TableHead>Привязка Adobe</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Нет клиентов</TableCell>
                                    </TableRow>
                                )}
                                {clients.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell>
                                            <div className="font-medium text-foreground">{c.email}</div>
                                            <div className="text-xs text-muted-foreground">ID: {c.id}</div>
                                        </TableCell>
                                        <TableCell>{c.telegram || '-'}</TableCell>
                                        <TableCell>{c.subscription_ends_at || 'Бессрочно'}</TableCell>
                                        <TableCell>
                                            {c.adobe_account_email ? (
                                                <div className="space-y-1">
                                                    <div className="font-medium text-primary text-sm">{c.adobe_account_email}</div>
                                                    <Badge variant={c.adobe_account_status === 'active' ? 'outline' : 'destructive'} className={c.adobe_account_status === 'active' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20 text-[10px]' : 'text-[10px]'}>
                                                        {c.adobe_account_status}
                                                    </Badge>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-</span>
                                            )}
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
