"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ExternalLink } from "lucide-react";

export default function AdobeListTab({ token, clients, onFetchClients }) {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);

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

    const handleAssign = async (id, client_id) => {
        if (!client_id) return;
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

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Пул аккаунтов Adobe ({accounts.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border h-[500px] overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Статус</TableHead>
                                    <TableHead>Привязка</TableHead>
                                    <TableHead className="text-right">Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {accounts.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Нет аккаунтов</TableCell>
                                    </TableRow>
                                )}
                                {accounts.map(acc => (
                                    <TableRow key={acc.id}>
                                        <TableCell>
                                            <div className="font-medium">{acc.email}</div>
                                            <a href={`/client/adobe/${acc.id}`} target="_blank" className="text-xs text-primary flex items-center gap-1 hover:underline mt-1">
                                                Ссылка <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={acc.status === 'active' ? 'outline' : 'destructive'} className={acc.status === 'active' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : ''}>
                                                {acc.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {acc.assigned_client_id ? (
                                                <span className="font-medium text-primary">{acc.client_email}</span>
                                            ) : (
                                                <Select onValueChange={(val) => handleAssign(acc.id, val)}>
                                                    <SelectTrigger className="w-[180px] h-8 text-xs">
                                                        <SelectValue placeholder="Свободен" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {clients.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.email}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
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
