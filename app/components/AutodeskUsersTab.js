"use client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, RefreshCw, AlertCircle, Search, UserPlus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AutodeskUsersTab({ token }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0); 
    const [hasMore, setHasMore] = useState(true);
    
    // Filters and Selection
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedUsers, setSelectedUsers] = useState(new Set());
    
    // Modals & Action loading
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [groupInput, setGroupInput] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    
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
                    setSelectedUsers(new Set());
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
                
                // Remove from selection if exists
                const newSet = new Set(selectedUsers);
                newSet.delete(userId);
                setSelectedUsers(newSet);
            } else {
                toast.error(`Ошибка удаления: ${data.error}`);
            }
        } catch (err) {
            toast.error(`Ошибка: ${err.message}`);
        }
    };
    
    const handleBulkDelete = async () => {
        if (selectedUsers.size === 0) return;
        if (!confirm(`Вы уверены что хотите удалить ${selectedUsers.size} пользователей?`)) return;
        
        try {
            setActionLoading(true);
            const res = await fetch('/api/autodesk/users/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ userIds: Array.from(selectedUsers) })
            });
            const data = await res.json();
            if (data.status === 'success') {
                toast.success(`Успешно удалено: ${data.data.success}, Ошибок: ${data.data.failed}`);
                setUsers(prev => prev.filter(u => !selectedUsers.has(u.userId || u.id)));
                setSelectedUsers(new Set());
            } else {
                toast.error(`Ошибка: ${data.error}`);
            }
        } catch (err) {
            toast.error(`Ошибка: ${err.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    const handleBulkAddGroup = async () => {
        if (!groupInput.trim()) return toast.error("Введите ID группы");
        if (selectedUsers.size === 0) return toast.error("Выберите пользователей");
        
        try {
            setActionLoading(true);
            const res = await fetch('/api/autodesk/users/add-group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ userIds: Array.from(selectedUsers), groupId: groupInput.trim() })
            });
            const data = await res.json();
            if (data.status === 'success') {
                toast.success(`Успешно добавлено в группу: ${data.data.success}, Ошибок: ${data.data.failed}`);
                setShowGroupModal(false);
                setGroupInput("");
                fetchUsers(0, false); // refresh to see new groups
            } else {
                toast.error(`Ошибка: ${data.error}`);
            }
        } catch (err) {
            toast.error(`Ошибка: ${err.message}`);
        } finally {
            setActionLoading(false);
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

    const filteredUsers = users.filter(user => {
        const email = (user.emailId || user.email || user.primaryEmail || '').toLowerCase();
        const name = `${user.firstName || user.name} ${user.lastName || ''}`.toLowerCase();
        
        if (searchQuery) {
            const sq = searchQuery.toLowerCase();
            if (!email.includes(sq) && !name.includes(sq)) return false;
        }
        
        const filteredGroups = (user.groups || []).filter(g => g.groupName !== 'everyone' && g.groupId !== 'everyone' && g.name !== 'everyone');
        const hasGroup = filteredGroups.length > 0;
        
        if (statusFilter === 'hasGroup' && !hasGroup) return false;
        if (statusFilter === 'noGroup' && hasGroup) return false;
        
        return true;
    });

    const toggleSelectAll = (checked) => {
        const newSet = new Set(selectedUsers);
        if (checked) {
            filteredUsers.forEach(u => newSet.add(u.userId || u.id));
        } else {
            filteredUsers.forEach(u => newSet.delete(u.userId || u.id));
        }
        setSelectedUsers(newSet);
    };

    const toggleSelectUser = (userId, checked) => {
        const newSet = new Set(selectedUsers);
        if (checked) newSet.add(userId);
        else newSet.delete(userId);
        setSelectedUsers(newSet);
    };

    const isAllSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUsers.has(u.userId || u.id));
    const isSomeSelected = filteredUsers.some(u => selectedUsers.has(u.userId || u.id)) && !isAllSelected;

    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Пользователи Autodesk</CardTitle>
                    <CardDescription>Список всех пользователей привязанных к вашему аккаунту.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    {selectedUsers.size > 0 && (
                        <>
                            <span className="text-sm text-muted-foreground mr-2">Выделено: {selectedUsers.size}</span>
                            <Button variant="outline" size="sm" onClick={() => setShowGroupModal(true)}>
                                <UserPlus className="w-4 h-4 mr-2 text-primary" /> В группу
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleBulkDelete} className="text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-4 h-4 mr-2" /> Удалить
                            </Button>
                        </>
                    )}
                    <Button variant="outline" size="sm" onClick={() => fetchUsers(0, false)} disabled={loading || loadingMore}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${(loading || loadingMore) && page === 0 ? 'animate-spin' : ''}`} /> Обновить
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-4 flex-1 overflow-hidden p-0 flex flex-col">
                <div className="px-4 pb-4 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Поиск по email или имени..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Все пользователи" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Все пользователи</SelectItem>
                            <SelectItem value="hasGroup">Есть группа</SelectItem>
                            <SelectItem value="noGroup">Нет группы</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {error && (
                    <div className="p-4 mx-4 mb-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <div>
                            <p className="font-semibold text-sm">Ошибка</p>
                            <p className="text-xs">{error}</p>
                            <p className="text-xs mt-1">Проверьте настройки API во вкладке "Загрузка аккаунтов".</p>
                        </div>
                    </div>
                )}
                
                <div className="flex-1 overflow-auto px-4 min-h-[500px]" onScroll={handleScroll}>
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[40px]">
                                    <Checkbox 
                                        checked={isAllSelected}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Select all"
                                        className={isSomeSelected ? "data-[state=unchecked]:bg-primary data-[state=unchecked]:text-primary-foreground" : ""}
                                    />
                                </TableHead>
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
                                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-6 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredUsers.length === 0 && !error ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                                        <Users className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                                        <p>Пользователей не найдено.</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user, i) => {
                                    const userId = user.userId || user.id;
                                    const email = user.emailId || user.email || user.primaryEmail;
                                    // Remove 'everyone' group
                                    const userGroups = (user.groups || []).filter(g => g.groupName !== 'everyone' && g.groupId !== 'everyone' && g.name !== 'everyone');
                                    const hasGroup = userGroups.length > 0;
                                    
                                    return (
                                        <TableRow key={userId || i} className="hover:bg-muted/50">
                                            <TableCell>
                                                <Checkbox 
                                                    checked={selectedUsers.has(userId)}
                                                    onCheckedChange={(c) => toggleSelectUser(userId, c)}
                                                    aria-label="Select user"
                                                />
                                            </TableCell>
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
                                                {hasGroup ? (
                                                    <span className="bg-green-100 text-green-700 border border-green-200 text-xs px-2 py-0.5 rounded-full font-medium">Есть группа</span>
                                                ) : (
                                                    <span className="bg-red-100 text-red-700 border border-red-200 text-xs px-2 py-0.5 rounded-full font-medium">Нет группы</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {hasGroup ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {userGroups.map(g => (
                                                            <span key={g.groupId || g.id} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20" title={g.groupId || g.id}>
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
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                            {loadingMore && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-4">
                                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            
            <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Добавить в группу</DialogTitle>
                        <DialogDescription>
                            Выбрано пользователей: <b>{selectedUsers.size}</b>. Введите ID группы, в которую хотите их добавить.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input 
                            value={groupInput}
                            onChange={(e) => setGroupInput(e.target.value)}
                            placeholder="Например: 780697849"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowGroupModal(false)} disabled={actionLoading}>Отмена</Button>
                        <Button onClick={handleBulkAddGroup} disabled={actionLoading || !groupInput.trim()}>
                            {actionLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                            Добавить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
