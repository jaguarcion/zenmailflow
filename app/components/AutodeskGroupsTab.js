"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Trash2, Plus, Box, ShieldCheck, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function AutodeskGroupsTab({ token }) {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Create Group State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [createLoading, setCreateLoading] = useState(false);

    // Manage Programs State
    const [manageGroup, setManageGroup] = useState(null);
    const [programsLoading, setProgramsLoading] = useState(false);
    const [seatpools, setSeatpools] = useState([]); // Available programs
    const [assignments, setAssignments] = useState([]); // Assigned programs
    const [selectedPoolId, setSelectedPoolId] = useState(""); // Program to add
    const [assignLoading, setAssignLoading] = useState(false);

    useEffect(() => {
        fetchGroups();
    }, [token]);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/autodesk/groups", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'success') {
                const results = data.data?.groups || data.data?.results || data.data || [];
                setGroups(Array.isArray(results) ? results : []);
            }
        } catch (error) {
            console.error("Failed to fetch groups:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        setCreateLoading(true);
        try {
            const res = await fetch("/api/autodesk/groups", {
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name: newGroupName.trim() })
            });
            if (res.ok) {
                setIsCreateOpen(false);
                setNewGroupName("");
                fetchGroups();
            } else {
                const err = await res.json();
                alert(`Ошибка: ${err.error}`);
            }
        } catch (error) {
            console.error("Failed to create group:", error);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDeleteGroup = async (groupId, groupName) => {
        if (!confirm(`Вы уверены, что хотите удалить группу "${groupName}"? Это действие нельзя отменить.`)) return;
        try {
            const res = await fetch(`/api/autodesk/groups?groupId=${groupId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                setGroups(groups.filter(g => (g.oxygenId || g.id) !== groupId));
            } else {
                const err = await res.json();
                alert(`Ошибка: ${err.error}`);
            }
        } catch (error) {
            console.error("Failed to delete group:", error);
        }
    };

    const openManagePrograms = async (group) => {
        setManageGroup(group);
        setProgramsLoading(true);
        setSelectedPoolId("");
        
        const groupId = group.oxygenId || group.id;
        try {
            const res = await fetch(`/api/autodesk/groups/assign?groupId=${groupId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'success') {
                let spData = data.data?.seatpools;
                let asData = data.data?.assignments;

                let spArray = Array.isArray(spData) ? spData : (spData?.results || spData?.pools || spData?.items || []);
                if (!Array.isArray(spArray)) spArray = [];

                let asArray = Array.isArray(asData) ? asData : (asData?.results || asData?.assignments || asData?.items || []);
                if (!Array.isArray(asArray)) asArray = [];

                // Normalize seatpools
                const normalizedSp = spArray.map(p => ({
                    poolKey: p.poolKey || p.key || p.pool?.key || '',
                    poolName: p.poolName || p.name || p.pool?.name || p.poolKey || p.key || p.pool?.key || 'Неизвестная программа',
                    poolType: p.poolType || p.type || p.pool?.type || 'EP',
                    raw: p
                })).filter(p => !!p.poolKey);

                // Normalize assignments
                const normalizedAs = asArray.map(a => ({
                    poolKey: a.poolKey || a.pool?.key || a.key || '',
                    poolName: a.poolName || a.pool?.name || a.name || a.pool?.key || a.poolKey || a.key || 'Неизвестная программа',
                    poolType: a.poolType || a.pool?.type || a.type || 'EP',
                    raw: a
                })).filter(a => !!a.poolKey);

                setSeatpools(normalizedSp);
                setAssignments(normalizedAs);
            }
        } catch (error) {
            console.error("Failed to fetch programs:", error);
        } finally {
            setProgramsLoading(false);
        }
    };

    const handleAssignProgram = async () => {
        if (!selectedPoolId || !manageGroup) return;
        
        const pool = seatpools.find(p => p.poolKey === selectedPoolId);
        if (!pool) return;

        setAssignLoading(true);
        const groupId = manageGroup.oxygenId || manageGroup.id;
        
        try {
            const res = await fetch(`/api/autodesk/groups/assign`, {
                method: "PUT",
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    groupId,
                    poolKey: pool.poolKey,
                    poolType: pool.poolType || "EP"
                })
            });
            
            if (res.ok) {
                // Refresh programs list to show the new assignment
                openManagePrograms(manageGroup);
            } else {
                const err = await res.json();
                alert(`Ошибка: ${err.error}`);
            }
        } catch (error) {
            console.error("Failed to assign program:", error);
        } finally {
            setAssignLoading(false);
        }
    };

    const handleRemoveProgram = async (assignment) => {
        if (!manageGroup) return;
        
        const groupId = manageGroup.oxygenId || manageGroup.id;
        const poolKey = assignment.poolKey;
        const poolType = assignment.poolType || "EP";

        if (!confirm(`Снять программу с группы?`)) return;

        try {
            const res = await fetch(`/api/autodesk/groups/assign?groupId=${groupId}&poolKey=${poolKey}&poolType=${poolType}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (res.ok) {
                setAssignments(assignments.filter(a => a.poolKey !== poolKey));
            } else {
                const err = await res.json();
                alert(`Ошибка: ${err.error}`);
            }
        } catch (error) {
            console.error("Failed to remove program:", error);
        }
    };

    // Derived states
    const assignedPoolKeys = new Set(assignments.map(a => a.poolKey));
    const availableSeatpools = seatpools.filter(p => !assignedPoolKeys.has(p.poolKey));

    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b shrink-0">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Box className="w-5 h-5 text-primary" />
                        Управление Группами
                    </CardTitle>
                    <CardDescription>
                        Создавайте группы и назначайте на них программы (Seat Pools)
                    </CardDescription>
                </div>
                
                <div className="flex gap-2 mt-4 sm:mt-0 w-full sm:w-auto">
                    <Button onClick={() => setIsCreateOpen(true)} className="flex-1 sm:flex-none">
                        <Plus className="w-4 h-4 mr-2" /> Создать группу
                    </Button>
                    <Button variant="outline" size="icon" onClick={fetchGroups} disabled={loading} title="Обновить список">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </CardHeader>
            
            <CardContent className="pt-4 flex-1 overflow-hidden p-0 flex flex-col">
                <div className="flex-1 overflow-auto px-4" style={{ height: 'calc(100vh - 250px)' }}>
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                            <TableRow>
                                <TableHead>Название группы</TableHead>
                                <TableHead>ID Группы</TableHead>
                                <TableHead>Кол-во участников</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && groups.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : groups.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        Группы не найдены. Создайте новую группу.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                groups.map((group, i) => {
                                    const groupId = group.oxygenId || group.id;
                                    const isEveryone = group.name === 'everyone' || group.groupName === 'everyone';
                                    
                                    if (isEveryone) return null;

                                    return (
                                        <TableRow key={groupId || i} className="hover:bg-muted/50">
                                            <TableCell className="font-medium text-sm">
                                                {group.name || group.groupName}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {groupId}
                                            </TableCell>
                                            <TableCell>
                                                {group.userCount !== undefined ? (
                                                    <span className="bg-muted px-2 py-1 rounded-md text-xs font-medium">
                                                        {group.userCount}
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="outline" size="sm" onClick={() => openManagePrograms(group)}>
                                                    <ShieldCheck className="w-4 h-4 mr-2" /> Программы
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteGroup(groupId, group.name)} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* Create Group Modal */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Создать новую группу</DialogTitle>
                        <DialogDescription>
                            Введите имя для новой группы Autodesk.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateGroup} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Название группы</label>
                            <Input 
                                value={newGroupName} 
                                onChange={(e) => setNewGroupName(e.target.value)} 
                                placeholder="Например: Designer Team" 
                                autoFocus
                                required
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={createLoading || !newGroupName.trim()}>
                                {createLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Создать
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Manage Programs Modal */}
            <Dialog open={!!manageGroup} onOpenChange={(open) => !open && setManageGroup(null)}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Программы группы "{manageGroup?.name}"</DialogTitle>
                        <DialogDescription>
                            Управление лицензиями (Seat Pools), привязанными к этой группе.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-2 space-y-6">
                        {programsLoading ? (
                            <div className="flex justify-center py-8">
                                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                {/* Assigned Programs */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold">Назначенные программы</h4>
                                    {assignments.length === 0 ? (
                                        <div className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-md border text-center">
                                            Нет назначенных программ
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-[250px] overflow-auto pr-1">
                                            {assignments.map((a, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-card border rounded-md shadow-sm">
                                                    <div>
                                                        <p className="font-medium text-sm">{a.poolName || a.poolKey}</p>
                                                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{a.poolKey}</p>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleRemoveProgram(a)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Assign New Program */}
                                <div className="space-y-3 pt-4 border-t">
                                    <h4 className="text-sm font-semibold">Назначить новую программу</h4>
                                    <div className="flex gap-2">
                                        <Select value={selectedPoolId} onValueChange={setSelectedPoolId}>
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Выберите программу из списка" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableSeatpools.length === 0 ? (
                                                    <SelectItem value="empty" disabled>Нет доступных программ</SelectItem>
                                                ) : (
                                                    availableSeatpools.map(p => (
                                                        <SelectItem key={p.poolKey} value={p.poolKey}>
                                                            {p.poolName || p.poolKey}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <Button onClick={handleAssignProgram} disabled={!selectedPoolId || assignLoading || selectedPoolId === 'empty'}>
                                            {assignLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                            Назначить
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

        </Card>
    );
}
