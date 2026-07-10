"use client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, RefreshCw, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AutodeskUsersTab({ token }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0); // offset basically
    const [hasMore, setHasMore] = useState(true);

    const limit = 50;

    const fetchUsers = async (offset = 0, append = false) => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/autodesk/users', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ limit, offset })
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                const fetchedUsers = data.data.results || [];
                if (append) {
                    setUsers(prev => [...prev, ...fetchedUsers]);
                } else {
                    setUsers(fetchedUsers);
                }
                
                // Assuming data.data.pagination.total exists, or we just check if we got full limit
                if (fetchedUsers.length < limit) {
                    setHasMore(false);
                } else {
                    setHasMore(true);
                }
                setPage(offset);
            } else {
                setError(data.error || 'Failed to fetch users');
                if (!append) setUsers([]);
            }
        } catch (err) {
            console.error("Failed to fetch autodesk users", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleScroll = (e) => {
        const { scrollTop, clientHeight, scrollHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight * 1.5 && !loading && hasMore) {
            fetchUsers(page + limit, true);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [token]);

    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Пользователи Autodesk</CardTitle>
                    <CardDescription>Список всех пользователей привязанных к вашему аккаунту.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchUsers(0, false)} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading && page === 0 ? 'animate-spin' : ''}`} /> Обновить
                </Button>
            </CardHeader>
            <CardContent className="pt-4 flex-1 overflow-hidden p-0">
                {error && (
                    <div className="p-4 m-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <div>
                            <p className="font-semibold text-sm">Ошибка</p>
                            <p className="text-xs">{error}</p>
                            <p className="text-xs mt-1">Проверьте настройки API во вкладке "Загрузка аккаунтов".</p>
                        </div>
                    </div>
                )}
                
                <div className="h-[600px] overflow-auto px-4" onScroll={handleScroll}>
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                            <TableRow>
                                <TableHead>Имя</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Роль</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead>Группы</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && page === 0 ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                                    </TableRow>
                                ))
                            ) : users.length === 0 && !error ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                                        <Users className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                                        <p>Пользователей не найдено.</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user, i) => (
                                    <TableRow key={user.userId || i} className="hover:bg-muted/50">
                                        <TableCell className="font-medium text-sm">
                                            {user.firstName} {user.lastName}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm text-muted-foreground">
                                            {user.emailId}
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs uppercase font-medium bg-muted px-2 py-0.5 rounded">
                                                {user.role || 'user'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {user.status === 'active' ? (
                                                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Активен</span>
                                            ) : user.status === 'pending' ? (
                                                <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">Ожидает</span>
                                            ) : (
                                                <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">{user.status}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {user.groups && user.groups.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {user.groups.map(g => (
                                                        <span key={g.groupId} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded" title={g.groupId}>
                                                            {g.groupName || g.groupId}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                            {loading && page > 0 && (
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
