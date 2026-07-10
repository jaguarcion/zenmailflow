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
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0); 
    const [hasMore, setHasMore] = useState(true);
    
    // Refs to prevent stale state in scroll handler
    const loadingRef = React.useRef(false);
    const hasMoreRef = React.useRef(true);
    const pageRef = React.useRef(0);

    const limit = 50;

    const fetchUsers = async (targetPage = 0, append = false) => {
        if (loadingRef.current) return;
        
        try {
            loadingRef.current = true;
            if (append) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }
            setError(null);
            
            const res = await fetch('/api/autodesk/users', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ limit, page: targetPage })
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                const fetchedUsers = data.data.results || [];
                if (append) {
                    setUsers(prev => {
                        const newUsers = fetchedUsers.filter(nu => !prev.some(pu => (pu.id || pu.userId) === (nu.id || nu.userId)));
                        return [...prev, ...newUsers];
                    });
                } else {
                    setUsers(fetchedUsers);
                }
                
                if (fetchedUsers.length < limit) {
                    setHasMore(false);
                    hasMoreRef.current = false;
                } else {
                    setHasMore(true);
                    hasMoreRef.current = true;
                }
                setPage(targetPage);
                pageRef.current = targetPage;
            } else {
                setError(data.error || 'Failed to fetch users');
                if (!append) setUsers([]);
            }
        } catch (err) {
            console.error("Failed to fetch autodesk users", err);
            setError(err.message);
        } finally {
            loadingRef.current = false;
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleDeleteUser = async (userId, userEmail) => {
        if (!confirm(`Вы уверены что хотите удалить пользователя ${userEmail}?`)) return;
        try {
            const res = await fetch('/api/autodesk/users/delete', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ userId })
            });
            const data = await res.json();
            if (data.status === 'success') {
                toast.success(`Пользователь ${userEmail} удален`);
                setUsers(prev => prev.filter(u => (u.id || u.userId) !== userId));
            } else {
                toast.error(`Ошибка удаления: ${data.error}`);
            }
        } catch (err) {
            toast.error(`Ошибка: ${err.message}`);
        }
    };

    const handleScroll = (e) => {
        const { scrollTop, clientHeight, scrollHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight * 1.5 && !loadingRef.current && hasMoreRef.current) {
            fetchUsers(pageRef.current + 1, true);
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
                <Button variant="outline" size="sm" onClick={() => fetchUsers(0, false)} disabled={loading || loadingMore}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${(loading || loadingMore) && page === 0 ? 'animate-spin' : ''}`} /> Обновить
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
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && users.length === 0 ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-6 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : users.length === 0 && !error ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                                        <Users className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                                        <p>Пользователей не найдено.</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user, i) => {
                                    const userId = user.userId || user.id;
                                    const email = user.emailId || user.email || user.primaryEmail;
                                    const status = user.status || user.accountStatus || user.state;
                                    
                                    return (
                                        <TableRow key={userId || i} className="hover:bg-muted/50">
                                            <TableCell className="font-medium text-sm">
                                                {user.firstName || user.name} {user.lastName}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm text-muted-foreground">
                                                {email || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs uppercase font-medium bg-muted px-2 py-0.5 rounded">
                                                    {user.role || 'user'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {status === 'active' || status === 'ACTIVE' ? (
                                                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Активен</span>
                                                ) : status === 'pending' || status === 'PENDING' || status === 'INVITED' ? (
                                                    <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">Ожидает</span>
                                                ) : (
                                                    <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">{status || '-'}</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {user.groups && user.groups.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {user.groups.map(g => (
                                                            <span key={g.groupId || g.id} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded" title={g.groupId || g.id}>
                                                                {g.groupName || g.name || g.groupId || g.id}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(userId, email)} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0">
                                                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 1C5.22386 1 5 1.22386 5 1.5C5 1.77614 5.22386 2 5.5 2H9.5C9.77614 2 10 1.77614 10 1.5C10 1.22386 9.77614 1 9.5 1H5.5ZM3 3.5C2.72386 3.5 2.5 3.72386 2.5 4C2.5 4.27614 2.72386 4.5 3 4.5H12C12.2761 4.5 12.5 4.27614 12.5 4C12.5 3.72386 12.2761 3.5 12 3.5H3ZM3.5 5.5V13C3.5 13.5523 3.94772 14 4.5 14H10.5C11.0523 14 11.5 13.5523 11.5 13V5.5H3.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                            {loadingMore && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-4">
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
