"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ActiveTasksWidget({ token }) {
    const [tasks, setTasks] = useState([]);
    const [isClosed, setIsClosed] = useState(false);

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
                        const progress = task.total > 0 ? Math.round(((task.success + task.error) / task.total) * 100) : 0;
                        const label = task.type === 'eset' ? 'Генерация ESET' : 'Извлечение Yopmail';
                        
                        return (
                            <div key={task.id} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium">{label}</span>
                                    <span className="text-muted-foreground text-xs">{task.success + task.error} / {task.total}</span>
                                </div>
                                <Progress value={progress} className="h-2" />
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
