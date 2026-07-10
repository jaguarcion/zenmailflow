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
                body: JSON.stringify({ limit, page: targetPage, search: searchQuery })
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                const fetchedUsers = data.data.results || [];
                if (append) {
                    setUsers(prev => {
                        const getUid = (u) => u.userId || u.id || u.oxygenId || u.emailId || u.email || u.primaryEmail || JSON.stringify(u);
                        const newUsers = fetchedUsers.filter(nu => !prev.some(pu => getUid(pu) === getUid(nu)));
                        
                        // If we fetched items but all were duplicates, stop paginating to prevent infinite loop
                        if (newUsers.length === 0 && fetchedUsers.length > 0) {
                            setHasMore(false);
                            hasMoreRef.current = false;
                        }
                        
                        return [...prev, ...newUsers];
                    });
                } else {
                    setUsers(fetchedUsers);
                    setSelectedUsers(new Set());
                }
                
                if (fetchedUsers.length < limit) {
                    setHasMore(false);
                    hasMoreRef.current = false;
                } else if (hasMoreRef.current !== false) { // Don't override if set to false by duplicate check
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
        const filteredGroups = (user.groups || []).filter(g => g.groupName !== 'everyone' && g.groupId !== 'everyone' && g.name !== 'everyone');
        const hasGroup = filteredGroups.length > 0;
        
        if (statusFilter === 'hasGroup' && !hasGroup) return false;
        if (statusFilter === 'noGroup' && hasGroup) return false;
        
        return true;
    });

    // Auto-fetch more users if a filter is active and we don't have enough results on screen
    useEffect(() => {
        if (statusFilter !== 'all' && hasMore && !loading && !loadingMore && filteredUsers.length < 15) {
            fetchUsers(pageRef.current + 1, true);
        }
    }, [statusFilter, hasMore, loading, loadingMore, filteredUsers.length]);

    const handleSearch = (e) => {
        if (e.key === 'Enter') {
            fetchUsers(0, false);
        }
    };

    const getUid = (u) => u.oxygenId || u.userId || u.id || u.subjectId || (u.emailId || u.email || u.primaryEmail || '').toLowerCase() || JSON.stringify(u);

    const toggleSelectAll = (checked) => {
        const newSet = new Set(selectedUsers);
        if (checked) {
            filteredUsers.forEach(u => newSet.add(getUid(u)));
        } else {
            filteredUsers.forEach(u => newSet.delete(getUid(u)));
        }
        setSelectedUsers(newSet);
    };

    const toggleSelectUser = (uid, checked) => {
        const newSet = new Set(selectedUsers);
        if (checked) newSet.add(uid);
        else newSet.delete(uid);
        setSelectedUsers(newSet);
    };

    const isAllSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUsers.has(getUid(u)));
    const isSomeSelected = filteredUsers.some(u => selectedUsers.has(getUid(u))) && !isAllSelected;

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
                    <div className="relative flex-1 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Поиск по email или имени (Enter)..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearch}
                            />
                        </div>
                        <Button variant="secondary" onClick={() => fetchUsers(0, false)} disabled={loading || loadingMore}>Найти</Button>
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
                
                <div className="h-[calc(100vh-250px)] overflow-auto px-4" onScroll={handleScroll}>
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} ref={r => r && (r.indeterminate = isSomeSelected)} aria-label="Select all" />
                                </TableHead>
                                <TableHead>Имя</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Роль</TableHead>
                                <TableHead>Статус</TableHead>
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
                                        <TableCell><Skeleton className="h-6 w-6 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredUsers.length === 0 && !error ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-20 text-muted-foreground">
                                        <Users className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                                        <p>Пользователей не найдено.</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user, i) => {
                                    const email = (user.emailId || user.email || user.primaryEmail || '').toLowerCase();
                                    const userId = user.oxygenId || user.userId || user.id || user.subjectId;
                                    const rowId = userId || email || String(i);
                                    // Remove 'everyone' group
                                    const userGroups = (user.groups || []).filter(g => g.groupName !== 'everyone' && g.groupId !== 'everyone' && g.name !== 'everyone');
                                    const hasGroup = userGroups.length > 0;
                                    
                                    return (
                                        <TableRow key={rowId} className="hover:bg-muted/50">
                                            <TableCell>
                                                <Checkbox 
                                                    checked={selectedUsers.has(rowId)}
                                                    onCheckedChange={(c) => toggleSelectUser(rowId, c)}
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
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                        Есть группа
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                                                        Нет группы
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(rowId, email)} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0">
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
                    
                    {/* Load More Button */}
                    {hasMore && !loading && filteredUsers.length > 0 && (
                        <div className="py-4 flex justify-center mt-2 mb-8">
                            <Button 
                                variant="outline" 
                                onClick={() => fetchUsers(pageRef.current + 1, true)}
                                disabled={loadingMore}
                            >
                                {loadingMore ? "Загрузка..." : "Загрузить еще"}
                            </Button>
                        </div>
                    )}
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
