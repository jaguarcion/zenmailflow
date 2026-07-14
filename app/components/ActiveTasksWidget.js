"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ActiveTasksWidget({ token }) {
    const [tasks, setTasks] = useState([]);
    const [isClosed, setIsClosed] = useState(false);
    const previousTaskIds = useRef(new Set());

    useEffect(() => {
        if (!token) return;

        let interval;

        const fetchTasks = async () => {
            try {
                const res = await fetch("/api/tasks/active", {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    const currentIds = new Set(data.tasks.map(t => t.id));
                    
                    // Check for completed tasks
                    previousTaskIds.current.forEach(oldId => {
                        if (!currentIds.has(oldId)) {
                            // Task completed!
                            toast.success("Фоновая задача успешно завершена!", {
                                description: "Результаты доступны в истории.",
                                duration: 5000,
                            });
                        }
                    });
                    
                    previousTaskIds.current = currentIds;
                    setTasks(data.tasks);
                    
                    if (data.tasks.length > 0 && isClosed) {
                        setIsClosed(false); // Reopen if new tasks arrive
                    }
                }
            } catch (err) {
                console.error("Failed to fetch active tasks", err);
            }
        };

        fetchTasks();
        interval = setInterval(fetchTasks, 3000);

        return () => clearInterval(interval);
    }, [token, isClosed]);

    if (tasks.length === 0 || isClosed) return null;

    const formatETA = (etaSeconds) => {
        if (etaSeconds < 0 || !isFinite(etaSeconds)) return 'расчет...';
        if (etaSeconds < 60) return `~${Math.round(etaSeconds)} сек`;
        return `~${Math.round(etaSeconds / 60)} мин`;
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 w-80 space-y-3 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <Card className="shadow-lg border-primary/20 overflow-hidden">
                <div className="bg-primary/10 px-4 py-2 flex items-center justify-between border-b border-primary/10">
                    <div className="text-xs font-semibold text-primary flex items-center gap-2 uppercase tracking-wider">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Фоновые задачи ({tasks.length})
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/20" onClick={() => setIsClosed(true)}>
                        <X className="w-3 h-3" />
                    </Button>
                </div>
                <CardContent className="p-4 space-y-4">
                    {tasks.map(task => {
                        const completed = task.success + task.error;
                        const progress = task.total > 0 ? Math.round((completed / task.total) * 100) : 0;
                        const label = task.type === 'eset' ? 'Генерация ESET' : task.type === 'autodesk' ? 'Инвайт Autodesk' : 'Извлечение Yopmail';
                        
                        // Calculate ETA
                        let etaSeconds = 0;
                        if (task.created_at && completed > 0) {
                            const timeElapsed = (Date.now() - new Date(task.created_at).getTime()) / 1000;
                            const timePerItem = timeElapsed / completed;
                            const remaining = task.total - completed;
                            etaSeconds = remaining * timePerItem;
                        }

                        return (
                            <div key={task.id} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium">{label}</span>
                                    <span className="text-muted-foreground text-xs">{completed} / {task.total}</span>
                                </div>
                                <Progress value={progress} className="h-2" />
                                {task.total > 0 && (
                                    <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1">
                                        <span>{progress}%</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {completed > 0 ? formatETA(etaSeconds) : 'оценка...'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
