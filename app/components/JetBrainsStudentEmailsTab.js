'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, RefreshCw, Upload, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function JetBrainsStudentEmailsTab({ token }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadText, setUploadText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/jetbrains/student-emails', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setEmails(data.data);
      } else {
        setError(data.error || 'Failed to fetch student emails');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchEmails();
    }
  }, [token]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} скопирован(а)`);
  };

  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map(e => e.id)));
    }
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
        toast.success(`Загружено ${data.added} новых аккаунтов`);
        setUploadText('');
        fetchEmails();
      } else {
        toast.error(data.error || 'Ошибка загрузки');
      }
    } catch (err) {
      toast.error('Ошибка сети при загрузке');
    } finally {
      setIsUploading(false);
    }
  };

  const handleActivate = async () => {
    const idsToActivate = Array.from(selectedIds);
    if (idsToActivate.length === 0) return;

    const itemsToActivate = emails.filter(e => idsToActivate.includes(e.id) && (e.status === 'pending' || e.status === 'error'));
    
    if (itemsToActivate.length === 0) {
      toast.info('Нет доступных для активации аккаунтов среди выбранных');
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
        setSelectedIds(new Set());
        fetchEmails();
      } else {
        toast.error(data.error || 'Ошибка активации');
      }
    } catch (err) {
      toast.error('Ошибка сети');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Удалить аккаунт?')) return;
    try {
      const res = await fetch(`/api/jetbrains/student-emails?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchEmails();
        toast.success('Удалено');
      }
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-slate-500/10 text-slate-500">Ожидает</Badge>;
      case 'processing': return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20"><RefreshCw className="w-3 h-3 mr-1 animate-spin"/> В процессе</Badge>;
      case 'active': return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Активирован</Badge>;
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
              Загрузите почты формата email:pass для автоматической активации
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="default">
                  <Upload className="w-4 h-4 mr-2" /> Загрузить почты
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
            <Button onClick={fetchEmails} disabled={loading} variant="outline" size="icon">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        
        {selectedIds.size > 0 && (
          <div className="px-6 pb-4 flex gap-2">
            <Button onClick={handleActivate} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Play className="w-4 h-4 mr-2" /> Активировать выбранные ({selectedIds.size})
            </Button>
          </div>
        )}

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
                  <TableHead className="w-12">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300"
                      checked={emails.length > 0 && selectedIds.size === emails.length}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Пароль</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Создано</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 float-right" /></TableCell>
                    </TableRow>
                  ))
                ) : emails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      Список почт пуст
                    </TableCell>
                  </TableRow>
                ) : (
                  emails.map((acc) => (
                    <TableRow key={acc.id} className={selectedIds.has(acc.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300"
                          checked={selectedIds.has(acc.id)}
                          onChange={() => toggleSelect(acc.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {acc.email}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => copyToClipboard(acc.email, 'Email')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{acc.password}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => copyToClipboard(acc.password, 'Пароль')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          {getStatusBadge(acc.status)}
                          {acc.error_message && (
                            <span className="text-[10px] text-red-500 max-w-[200px] truncate" title={acc.error_message}>
                              {acc.error_message}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(acc.created_at).toLocaleString('ru-RU')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(acc.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
