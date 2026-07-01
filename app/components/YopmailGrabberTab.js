"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Download, Upload, Zap, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function YopmailGrabberTab({ token }) {
    const [emailsInput, setEmailsInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            setEmailsInput(prev => prev.trim() ? prev + '\n' + content : content);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleExtract = async () => {
        const lines = emailsInput.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length === 0) {
            toast.error("Введите ссылки или загрузите файл");
            return;
        }

        setLoading(true);
        let initialTasks = lines.map((url, i) => ({
            id: i,
            url,
            status: 'pending', // pending, processing, success, error
            alias: null,
            error: null
        }));
        
        setResults(initialTasks);
        
        const CONCURRENCY = 5;
        let maxGlobalRetries = 3;
        let cycleCount = 0;
        
        let currentCycleTasks = [...initialTasks];
        const allResults = [...initialTasks]; // To maintain state reference

        while (currentCycleTasks.length > 0 && cycleCount < maxGlobalRetries) {
            let queue = [...currentCycleTasks];
            currentCycleTasks = []; // Holds errors for next retry cycle
            let currentIndex = 0;

            const updateTask = (id, updates) => {
                const idx = allResults.findIndex(t => t.id === id);
                if (idx !== -1) {
                    allResults[idx] = { ...allResults[idx], ...updates };
                    setResults([...allResults]);
                }
            };

            async function worker() {
                while (currentIndex < queue.length) {
                    const task = queue[currentIndex++];
                    
                    updateTask(task.id, { status: 'processing' });

                    try {
                        const response = await fetch('/api/autodesk/yopmail', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ url: task.url })
                        });
                        
                        const data = await response.json();
                        
                        if (data.status === 'success' && data.alias) {
                            updateTask(task.id, { status: 'success', alias: data.alias });
                        } else {
                            updateTask(task.id, { status: 'error', error: data.error || 'Не найдено' });
                            currentCycleTasks.push(allResults.find(t => t.id === task.id));
                        }
                    } catch (err) {
                        updateTask(task.id, { status: 'error', error: 'Сетевая ошибка' });
                        currentCycleTasks.push(allResults.find(t => t.id === task.id));
                    }
                }
            }

            const workers = Array(Math.min(CONCURRENCY, queue.length)).fill(0).map(worker);
            await Promise.all(workers);
            
            cycleCount++;
        }

        // Finalize remaining errors
        currentCycleTasks.forEach(task => {
            updateTask(task.id, { error: task.error + ' (Исчерпаны попытки)' });
        });

        setLoading(false);
        
        const successCount = allResults.filter(t => t.status === 'success').length;
        toast.success(`Готово! Извлечено алиасов: ${successCount} из ${lines.length}`);
    };

    const handleCopyAll = () => {
        const successfulAliases = results.filter(t => t.status === 'success' && t.alias).map(t => t.alias);
        if (successfulAliases.length === 0) return;
        navigator.clipboard.writeText(successfulAliases.join('\n'));
        toast.success("Скопировано в буфер обмена");
    };

    const handleDownload = () => {
        const successfulTasks = results.filter(t => t.status === 'success' && t.alias);
        if (successfulTasks.length === 0) return;
        const csvData = successfulTasks.map(t => `${t.url},${t.alias}`).join('\n');
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'yopmail_aliases.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    const successfulCount = results.filter(t => t.status === 'success').length;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Парсер алиасов YOPmail</CardTitle>
                    <CardDescription>Извлечение скрытых почтовых ящиков из одноразовых ссылок YOPmail</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium">Введите ссылки (по одной в строке):</label>
                        <div>
                            <input 
                                type="file" 
                                id="fileUpload" 
                                accept=".txt,.csv" 
                                className="hidden" 
                                onChange={handleFileUpload} 
                            />
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => document.getElementById('fileUpload').click()}
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                Загрузить файл
                            </Button>
                        </div>
                    </div>
                    
                    <textarea 
                        className="flex min-h-[150px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="https://yopmail.com?example1..."
                        value={emailsInput}
                        onChange={(e) => setEmailsInput(e.target.value)}
                    ></textarea>

                    <Button onClick={handleExtract} disabled={loading} className="w-full sm:w-auto">
                        {loading ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                        {loading ? "Извлечение..." : "Начать парсинг"}
                    </Button>
                </CardContent>
            </Card>

            {results.length > 0 && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle>Результаты</CardTitle>
                            <CardDescription>Успешно: {successfulCount} / {results.length}</CardDescription>
                        </div>
                        <div className="flex space-x-2">
                            <Button variant="outline" size="sm" onClick={handleCopyAll} disabled={successfulCount === 0}>
                                <Copy className="h-4 w-4 mr-2" />
                                Копировать
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleDownload} disabled={successfulCount === 0}>
                                <Download className="h-4 w-4 mr-2" />
                                CSV
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>URL</TableHead>
                                        <TableHead>Алиас</TableHead>
                                        <TableHead>Статус</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-mono text-xs max-w-[200px] truncate" title={item.url}>
                                                {item.url}
                                            </TableCell>
                                            <TableCell className="font-mono font-medium">
                                                {item.status === 'processing' && <RefreshCcw className="h-4 w-4 animate-spin text-muted-foreground" />}
                                                {item.status === 'success' && <span className="text-blue-600">{item.alias}</span>}
                                                {item.status === 'error' && <span className="text-red-500 text-xs">{item.error}</span>}
                                            </TableCell>
                                            <TableCell>
                                                {item.status === 'pending' && <Badge variant="outline">В очереди</Badge>}
                                                {item.status === 'processing' && <Badge variant="secondary">Обработка</Badge>}
                                                {item.status === 'success' && <Badge className="bg-green-500 hover:bg-green-600">Успех</Badge>}
                                                {item.status === 'error' && <Badge variant="destructive">Ошибка</Badge>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
