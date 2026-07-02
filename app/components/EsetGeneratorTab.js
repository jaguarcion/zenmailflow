"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap, Download, RefreshCw, XCircle, CheckCircle2, Clock } from "lucide-react";

export default function EsetGeneratorTab({ token }) {
    const [count, setCount] = useState(1);
    const [loading, setLoading] = useState(false);
    const [activeTaskId, setActiveTaskId] = useState(null);
    const [activeTask, setActiveTask] = useState(null);

    // Load active task from local storage if exists
    useEffect(() => {
        const savedTask = localStorage.getItem('eset_active_task');
        if (savedTask) {
            setActiveTaskId(savedTask);
        }
    }, []);

    useEffect(() => {
        let interval;
        if (activeTaskId) {
            const fetchTask = async () => {
                try {
                    const res = await fetch(`/api/eset/tasks/${activeTaskId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.success && data.task) {
                        const task = data.task;
                        task.items = JSON.parse(task.items_json || '[]');
                        setActiveTask(task);
                        
                        if (task.status !== 'processing') {
                            setLoading(false);
                            clearInterval(interval);
                            if (task.status === 'success') toast.success("Генерация завершена!");
                        }
                    } else if (data.status === 404) {
                        setActiveTaskId(null);
                        localStorage.removeItem('eset_active_task');
                        clearInterval(interval);
                    }
                } catch (err) {
                    console.error("Error fetching task", err);
                }
            };
            
            fetchTask();
            interval = setInterval(fetchTask, 2000);
            setLoading(true);
        }
        return () => clearInterval(interval);
    }, [activeTaskId, token]);

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (count < 1 || count > 100) return;
        
        setLoading(true);
        setActiveTask(null);

        try {
            const res = await fetch("/api/eset/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ count }),
            });
            const data = await res.json();

            if (data.success) {
                setActiveTaskId(data.taskId);
                localStorage.setItem('eset_active_task', data.taskId);
                toast.success("Задача генерации запущена!");
            } else {
                toast.error(data.error || "Произошла ошибка при запуске");
                setLoading(false);
            }
        } catch (err) {
            toast.error("Ошибка сети.");
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!activeTaskId) return;
        try {
            await fetch(`/api/eset/tasks/${activeTaskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setActiveTaskId(null);
            setActiveTask(null);
            localStorage.removeItem('eset_active_task');
            setLoading(false);
            toast.info("Задача отменена.");
        } catch (err) {
            toast.error("Ошибка при отмене");
        }
    };

    const handleDownloadTxt = (items) => {
        if (!items || items.length === 0) return;
        const content = items.map(e => `${e.licenseKey}`).join("\n");
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `eset-keys-${new Date().toISOString().split("T")[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card>
                <CardHeader>
                    <CardTitle>Генератор ключей ESET</CardTitle>
                    <CardDescription>Запустите процесс массовой генерации триальных ключей.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="space-y-2 flex-1 sm:max-w-[200px]">
                            <label className="text-sm font-medium">Количество ключей</label>
                            <Input type="number" min="1" max="100" value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)} required disabled={loading} />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                            {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                            {loading ? "Генерация..." : "Запустить"}
                        </Button>
                        {loading && (
                            <Button type="button" variant="destructive" onClick={handleCancel} className="w-full sm:w-auto">
                                <XCircle className="w-4 h-4 mr-2" /> Отмена
                            </Button>
                        )}
                    </form>
                </CardContent>
            </Card>

            {activeTask && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                Результаты задачи 
                                {activeTask.status === 'processing' && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full flex items-center"><RefreshCw className="w-3 h-3 mr-1 animate-spin"/> В процессе ({activeTask.success}/{activeTask.total})</span>}
                                {activeTask.status === 'success' && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> Завершено</span>}
                                {activeTask.status === 'cancelled' && <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full flex items-center"><Clock className="w-3 h-3 mr-1"/> Отменена</span>}
                            </CardTitle>
                            <CardDescription className="mt-1 text-xs">Успешно: <span className="text-green-600 font-bold">{activeTask.success}</span> | Ошибки: <span className="text-red-600 font-bold">{activeTask.error}</span></CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleDownloadTxt(activeTask.items)} disabled={!activeTask.items || activeTask.items.length === 0}>
                                <Download className="w-4 h-4 mr-2" /> Скачать ключи
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {!activeTask.items || activeTask.items.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed bg-muted/10">
                                {activeTask.status === 'processing' ? 'Ожидание сгенерированных ключей...' : 'Нет сгенерированных ключей'}
                            </div>
                        ) : (
                            <div className="rounded-md border shadow-sm max-h-[400px] overflow-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Account Pass</TableHead>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Key</TableHead>
                                            <TableHead>Expires</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeTask.items.map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-mono text-xs">{item.email}</TableCell>
                                                <TableCell className="font-mono text-xs">{item.accountPassword}</TableCell>
                                                <TableCell className="text-xs font-medium text-primary">{item.productName}</TableCell>
                                                <TableCell className="font-mono text-sm font-bold bg-muted/30 px-2 rounded">{item.licenseKey}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{item.expirationDate?.split('T')[0]}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
