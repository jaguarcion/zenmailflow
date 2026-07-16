'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, RefreshCw, Upload, Trash2, Play, ChevronDown, ChevronRight, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function JetBrainsStudentEmailsTab({ token }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadText, setUploadText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchTasks = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const res = await fetch('/api/jetbrains/student-emails', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setTasks(data.data);
      } else {
        setError(data.error || 'Failed to fetch student tasks');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTasks();
      const interval = setInterval(() => fetchTasks(false), 10000); // silent refresh every 10s
      return () => clearInterval(interval);
    }
  }, [token]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} скопирован(а)`);
  };

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedTasks(newExpanded);
  };

  const handleUpload = async () => {
    if (!uploadText.trim()) return;
    const lines = uploadText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;

    try {
      setIsUploading(true);
      const res = await fetch('/api/jetbrains/student-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ lines })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Партия загружена! Добавлено ${data.added} новых аккаунтов`);
        setUploadText('');
        setIsDialogOpen(false);
        fetchTasks();
      } else {
        toast.error(data.error || 'Ошибка загрузки');
      }
    } catch (err) {
      toast.error('Ошибка сети при загрузке');
    } finally {
      setIsUploading(false);
    }
  };

  const handleActivateTask = async (task, e) => {
    if (e) e.stopPropagation();
    
    const itemsToActivate = task.items.filter(item => item.status === 'pending' || item.status === 'error');
    if (itemsToActivate.length === 0) {
      toast.info('Нет доступных для активации аккаунтов в этой партии');
      return;
    }

    try {
      const res = await fetch('/api/jetbrains/student-emails/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ items: itemsToActivate })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Отправлено в обработку: ${data.enqueued}`);
        fetchTasks(); // refresh to show processing status
      } else {
        toast.error(data.error || 'Ошибка активации');
      }
    } catch (err) {
      toast.error('Ошибка сети');
    }
  };

  const handleDeleteTask = async (id, e) => {
    if (e) e.stopPropagation();
    if (!confirm('Удалить эту партию и все связанные с ней аккаунты?')) return;
    try {
      const res = await fetch(`/api/jetbrains/student-emails?task_id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchTasks();
        toast.success('Партия удалена');
      }
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  const handleDeleteEmail = async (id, e) => {
    if (e) e.stopPropagation();
    if (!confirm('Удалить этот аккаунт?')) return;
    try {
      const res = await fetch(`/api/jetbrains/student-emails?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchTasks();
        toast.success('Аккаунт удален');
      }
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-slate-500/10 text-slate-500"><Clock className="w-3 h-3 mr-1"/> Ожидает</Badge>;
      case 'processing': return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20"><RefreshCw className="w-3 h-3 mr-1 animate-spin"/> В процессе</Badge>;
      case 'active': return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1"/> Активирован</Badge>;
      case 'completed': return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1"/> Завершено</Badge>;
      case 'error': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Ошибка</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <Card className="flex flex-col h-[calc(100vh-140px)]">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>Пул почт (Student)</CardTitle>
            <CardDescription>
              Загрузите партии почт формата email:pass для автоматической активации
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default">
                  <Upload className="w-4 h-4 mr-2" /> Загрузить партию
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Массовая загрузка почт</DialogTitle>
                  <DialogDescription>Вставьте почты в формате email:pass, каждая с новой строки.</DialogDescription>
                </DialogHeader>
                <Textarea 
                  value={uploadText} 
                  onChange={(e) => setUploadText(e.target.value)}
                  placeholder={"student1@edu.com:pass123\nstudent2@edu.com:pass456"}
                  className="h-48 font-mono text-xs"
                />
                <DialogFooter>
                  <Button onClick={handleUpload} disabled={isUploading || !uploadText.trim()}>
                    {isUploading ? 'Загрузка...' : 'Добавить'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={() => fetchTasks(true)} disabled={loading} variant="outline" size="icon">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        
        {error && (
          <div className="px-6 pb-2">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
              {error}
            </div>
          </div>
        )}

        <CardContent className="flex-1 overflow-hidden flex flex-col p-0 px-6 pb-6">
          <div className="rounded-md border flex-1 overflow-auto scrollbar-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Дата (ID Партии)</TableHead>
                  <TableHead>Статус партии</TableHead>
                  <TableHead>Успешно / Ошибок / Всего</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && tasks.length === 0 ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[100px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16 float-right" /></TableCell>
                    </TableRow>
                  ))
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      Список партий пуст
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => {
                    const isExpanded = expandedTasks.has(task.id);
                    return (
                      <React.Fragment key={task.id}>
                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(task.id)}>
                          <TableCell>
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {new Date(task.created_at).toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{task.id.split('-')[0]}</div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(task.status)}
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
                              {(task.pending > 0 || task.error > 0) && task.processing === 0 && (
                                <Button variant="ghost" size="sm" onClick={(e) => handleActivateTask(task, e)} className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-100" title="Активировать партию">
                                  <Play className="w-4 h-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={(e) => handleDeleteTask(task.id, e)} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0" title="Удалить партию">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {isExpanded && (
                          <TableRow className="bg-muted/10">
                            <TableCell colSpan={5} className="p-0 border-b">
                              <div className="p-4 bg-muted/20 inset-shadow-sm">
                                {task.items.length === 0 ? (
                                  <div className="text-center text-sm text-muted-foreground py-2">Нет аккаунтов в этой партии</div>
                                ) : (
                                  <div className="max-h-[300px] overflow-y-auto border rounded bg-background">
                                    <Table>
                                      <TableHeader className="bg-muted/40 sticky top-0">
                                        <TableRow>
                                          <TableHead className="py-2 text-xs">Email</TableHead>
                                          <TableHead className="py-2 text-xs">Пароль</TableHead>
                                          <TableHead className="py-2 text-xs">Статус</TableHead>
                                          <TableHead className="py-2 text-xs text-right">Действия</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {task.items.map((acc) => (
                                          <TableRow key={acc.id}>
                                            <TableCell className="py-2 font-mono text-xs text-primary">
                                              <div className="flex items-center gap-2">
                                                {acc.email}
                                                <Button variant="ghost" size="icon" className="h-4 w-4 text-muted-foreground" onClick={() => copyToClipboard(acc.email, 'Email')} title="Копировать">
                                                  <Copy className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            </TableCell>
                                            <TableCell className="py-2 text-xs font-mono">
                                              <span className="bg-muted px-2 py-1 rounded-md text-muted-foreground">{acc.password}</span>
                                            </TableCell>
                                            <TableCell className="py-2">
                                              <div className="flex flex-col gap-1 items-start">
                                                {getStatusBadge(acc.status)}
                                                {acc.error_message && (
                                                  <span className="text-[10px] text-red-500 max-w-[200px] truncate" title={acc.error_message}>
                                                    {acc.error_message}
                                                  </span>
                                                )}
                                              </div>
                                            </TableCell>
                                            <TableCell className="py-2 text-right">
                                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={(e) => handleDeleteEmail(acc.id, e)} title="Удалить">
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </TableCell>
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
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
