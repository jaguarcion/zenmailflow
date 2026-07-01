"use client";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Upload, Zap, RefreshCcw, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function YopmailGrabberTab({ token }) {
    const [emailsInput, setEmailsInput] = useState("");
    const [tasks, setTasks] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [expandedTasks, setExpandedTasks] = useState({});
    const cancelledTasksRef = useRef(new Set());

    // Load tasks from API on mount
    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const res = await fetch('/api/autodesk/yopmail/tasks', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.status === 'success') {
                    setTasks(data.tasks);
                }
            } catch (err) {
                console.error("Failed to load tasks", err);
            }
            setIsLoaded(true);
        };
        fetchTasks();
    }, [token]);

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

    const toggleTaskExpand = (taskId) => {
        setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
    };

    const startTask = (lines) => {
        const taskId = Date.now().toString();
        const initialItems = lines.map((url, i) => ({
            id: i,
            url,
            status: 'pending',
            alias: null,
            error: null
        }));

        const newTask = {
            id: taskId,
            date: new Date().toLocaleString(),
            status: 'processing',
            total: lines.length,
            success: 0,
            error: 0,
            items: initialItems
        };

        setTasks(prev => [newTask, ...prev]);
        setExpandedTasks(prev => ({ ...prev, [taskId]: true })); // Expand by default
        
        // Save initial task to DB
        fetch('/api/autodesk/yopmail/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(newTask)
        }).catch(() => {});

        processTask(taskId, initialItems, token);
    };

    const processTask = async (taskId, items, token) => {
        const CONCURRENCY = 5;
        let maxGlobalRetries = 3;
        let cycleCount = 0;

        let currentCycleTasks = [...items];

        const updateItem = (itemId, updates) => {
            setTasks(prev => prev.map(t => {
                if (t.id === taskId) {
                    const newItems = t.items.map(i => i.id === itemId ? { ...i, ...updates } : i);
                    const successCount = newItems.filter(i => i.status === 'success').length;
                    const errorCount = newItems.filter(i => i.status === 'error').length;
                    const pendingCount = newItems.filter(i => i.status === 'pending' || i.status === 'processing').length;
                    const updatedTask = {
                        ...t,
                        items: newItems,
                        success: successCount,
                        error: errorCount,
                        status: pendingCount === 0 ? 'completed' : 'processing'
                    };
                    
                    // Sync progress to DB
                    fetch(`/api/autodesk/yopmail/tasks/${taskId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify(updatedTask)
                    }).catch(() => {});

                    return updatedTask;
                }
                return t;
            }));
        };

        while (currentCycleTasks.length > 0 && cycleCount < maxGlobalRetries) {
            if (cancelledTasksRef.current.has(taskId)) break;
            
            let queue = [...currentCycleTasks];
            currentCycleTasks = [];
            let currentIndex = 0;

            async function worker() {
                while (currentIndex < queue.length) {
                    if (cancelledTasksRef.current.has(taskId)) return;
                    
                    const task = queue[currentIndex++];
                    updateItem(task.id, { status: 'processing' });

                    try {
                        const response = await fetch('/api/autodesk/yopmail', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ url: task.url })
                        });
                        const data = await response.json();

                        if (data.status === 'success' && data.alias) {
                            updateItem(task.id, { status: 'success', alias: data.alias });
                        } else {
                            currentCycleTasks.push(task);
                        }
                    } catch (err) {
                        currentCycleTasks.push(task);
                    }
                }
            }

            const workers = Array(Math.min(CONCURRENCY, queue.length)).fill(0).map(worker);
            await Promise.all(workers);
            cycleCount++;
        }

        // Finalize errors
        if (!cancelledTasksRef.current.has(taskId)) {
            currentCycleTasks.forEach(task => {
                updateItem(task.id, { status: 'error', error: 'Не удалось получить алиас' });
            });
        }
    };

    const handleExtract = () => {
        const lines = emailsInput.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length === 0) {
            toast.error("Введите ссылки или загрузите файл");
            return;
        }
        setEmailsInput("");
        startTask(lines);
    };

    const handleCopyEmails = (task) => {
        const aliases = task.items.filter(i => i.status === 'success' && i.alias).map(i => i.alias);
        if (aliases.length === 0) {
            toast.error("Нет успешных почт для копирования");
            return;
        }
        navigator.clipboard.writeText(aliases.join('\n'));
        toast.success(`Скопировано ${aliases.length} почт`);
    };

    const handleDeleteTask = async (taskId) => {
        cancelledTasksRef.current.add(taskId);
        setTasks(prev => prev.filter(t => t.id !== taskId));
        try {
            await fetch(`/api/autodesk/yopmail/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success("Задача удалена");
        } catch (err) {
            toast.error("Ошибка удаления");
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Парсер алиасов YOPmail (Фоновый режим)</CardTitle>
                    <CardDescription>Извлечение скрытых почтовых ящиков из одноразовых ссылок YOPmail</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium">Введите ссылки (по одной в строке):</label>
                        <div>
                            <input type="file" id="fileUpload" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
                            <Button variant="outline" size="sm" onClick={() => document.getElementById('fileUpload').click()}>
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

                    <Button onClick={handleExtract} className="w-full sm:w-auto">
                        <Zap className="h-4 w-4 mr-2" />
                        Создать задачу парсинга
                    </Button>
                </CardContent>
            </Card>

            {tasks.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">История задач</h3>
                    {tasks.map(task => (
                        <Card key={task.id} className="overflow-hidden">
                            <div 
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => toggleTaskExpand(task.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">Задача от {task.date}</span>
                                        <div className="flex gap-2 text-xs mt-1">
                                            <span className="text-muted-foreground">Всего: {task.total}</span>
                                            <span className="text-green-600">Успех: {task.success}</span>
                                            <span className="text-red-500">Ошибок: {task.error}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {task.status === 'processing' ? (
                                        <Badge variant="secondary" className="flex items-center gap-1">
                                            <RefreshCcw className="h-3 w-3 animate-spin" /> В процессе
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-green-500 hover:bg-green-600">Завершено</Badge>
                                    )}
                                    {expandedTasks[task.id] ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                                </div>
                            </div>
                            
                            {expandedTasks[task.id] && (
                                <div className="border-t bg-muted/20 p-4">
                                    <div className="flex justify-between mb-4">
                                        <Button size="sm" variant="outline" onClick={() => handleCopyEmails(task)} disabled={task.success === 0}>
                                            <Copy className="h-4 w-4 mr-2" /> Скопировать успешные почты
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => handleDeleteTask(task.id)}>
                                            <Trash2 className="h-4 w-4 mr-2" /> Удалить задачу
                                        </Button>
                                    </div>
                                    
                                    <div className="max-h-[300px] overflow-auto rounded-md border bg-background text-sm">
                                        <table className="w-full">
                                            <tbody>
                                                {task.items.map(item => (
                                                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                                                        <td className="p-2 font-mono text-xs max-w-[200px] truncate" title={item.url}>{item.url}</td>
                                                        <td className="p-2 font-mono">
                                                            {item.status === 'processing' && <span className="text-muted-foreground">Извлечение...</span>}
                                                            {item.status === 'success' && <span className="text-blue-600">{item.alias}</span>}
                                                            {item.status === 'error' && <span className="text-red-500 text-xs">Ошибка</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
