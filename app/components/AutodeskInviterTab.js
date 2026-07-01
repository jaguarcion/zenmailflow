"use client";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Play, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import Papa from "papaparse";

export default function AutodeskInviterTab({ token }) {
    const [config, setConfig] = useState({
        tenantId: "63238795",
        invitedBy: "2S82WAKKQY6ZQB2X",
        authToken: "",
        cookieString: ""
    });
    
    const [users, setUsers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [isInviting, setIsInviting] = useState(false);
    const [stats, setStats] = useState({ success: 0, error: 0 });
    const fileInputRef = useRef(null);
    const logsEndRef = useRef(null);

    const handleConfigChange = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const parsedUsers = results.data.map(row => {
                    // Обработка различных вариантов названий колонок
                    const email = row['Email'] || row['email'] || row['EmailId'] || row['emailId'] || Object.values(row)[0];
                    const firstName = row['FirstName'] || row['firstName'] || row['First Name'] || '';
                    const lastName = row['LastName'] || row['lastName'] || row['Last Name'] || '';
                    
                    return { email: email?.trim(), firstName: firstName?.trim(), lastName: lastName?.trim(), status: 'pending' };
                }).filter(u => u.email);

                setUsers(parsedUsers);
                setStats({ success: 0, error: 0 });
                setLogs([{ type: 'info', message: `Успешно загружено ${parsedUsers.length} пользователей из ${file.name}` }]);
                toast.success(`Загружено ${parsedUsers.length} пользователей`);
            },
            error: function(err) {
                toast.error("Ошибка чтения CSV: " + err.message);
            }
        });
        
        // Reset file input
        e.target.value = '';
    };

    const addLog = (type, message) => {
        setLogs(prev => [...prev, { type, message, time: new Date().toLocaleTimeString() }]);
        setTimeout(() => {
            logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const startInvites = async () => {
        if (!config.authToken || !config.cookieString) {
            toast.error("Заполните Auth Token и Cookie");
            return;
        }

        if (users.length === 0) {
            toast.error("Загрузите CSV с пользователями");
            return;
        }

        setIsInviting(true);
        addLog('info', 'Запуск процесса приглашений...');
        
        let successCount = 0;
        let errorCount = 0;
        const updatedUsers = [...users];

        for (let i = 0; i < updatedUsers.length; i++) {
            const user = updatedUsers[i];
            if (user.status === 'success') continue;

            addLog('info', `[${i + 1}/${updatedUsers.length}] Приглашение: ${user.email}`);

            try {
                const res = await fetch('/api/autodesk/invite', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({
                        tenant_id: config.tenantId,
                        invited_by: config.invitedBy,
                        auth_token: config.authToken,
                        cookie: config.cookieString,
                        user: {
                            email: user.email,
                            firstName: user.firstName,
                            lastName: user.lastName
                        }
                    })
                });

                const data = await res.json();

                if (res.ok) {
                    user.status = 'success';
                    successCount++;
                    addLog('success', `Успешно: ${user.email}`);
                } else {
                    user.status = 'error';
                    errorCount++;
                    const errMsg = data.message || data.error || JSON.stringify(data);
                    addLog('error', `Ошибка (${user.email}): ${errMsg}`);
                }
            } catch (err) {
                user.status = 'error';
                errorCount++;
                addLog('error', `Ошибка сети (${user.email}): ${err.message}`);
            }

            setUsers([...updatedUsers]);
            setStats({ success: successCount, error: errorCount });
            
            // Задержка между запросами
            await new Promise(r => setTimeout(r, 500));
        }

        addLog('info', 'Процесс завершен!');
        setIsInviting(false);
        toast.success(`Завершено. Успешно: ${successCount}, Ошибок: ${errorCount}`);
    };

    const resetProcess = () => {
        setUsers([]);
        setLogs([]);
        setStats({ success: 0, error: 0 });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Настройки API Autodesk</CardTitle>
                        <CardDescription>Введите данные для авторизации в панели Autodesk</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Tenant ID</label>
                            <Input name="tenantId" value={config.tenantId} onChange={handleConfigChange} placeholder="63238795" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Invited By ID</label>
                            <Input name="invitedBy" value={config.invitedBy} onChange={handleConfigChange} placeholder="2S82WAKKQY6ZQB2X" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Authorization Token</label>
                            <Textarea 
                                name="authToken" 
                                value={config.authToken} 
                                onChange={handleConfigChange} 
                                placeholder="Bearer eyJhbGciOi..." 
                                className="h-20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Cookie String</label>
                            <Textarea 
                                name="cookieString" 
                                value={config.cookieString} 
                                onChange={handleConfigChange} 
                                placeholder="OptanonAlertBoxClosed=..." 
                                className="h-20"
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Список пользователей (CSV)</CardTitle>
                        <CardDescription>Загрузите CSV файл (Колонки: Email, FirstName, LastName)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center">
                            <Upload className="h-8 w-8 text-muted-foreground mb-4" />
                            <h3 className="font-medium mb-1">Загрузите файл с базой</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Поддерживается формат .csv
                            </p>
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isInviting}>
                                Выбрать CSV файл
                            </Button>
                            
                            {users.length > 0 && (
                                <p className="mt-4 text-sm font-medium text-green-600">
                                    К загрузке готово: {users.length} пользователей
                                </p>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button 
                                onClick={startInvites} 
                                disabled={isInviting || users.length === 0}
                                className="flex-1"
                            >
                                {isInviting ? <RotateCcw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                {isInviting ? "Рассылка инвайтов..." : "Начать приглашения"}
                            </Button>
                            
                            <Button 
                                variant="outline" 
                                onClick={resetProcess} 
                                disabled={isInviting || users.length === 0}
                            >
                                Сбросить
                            </Button>
                        </div>

                        <div className="flex justify-between items-center text-sm px-2">
                            <span className="flex items-center text-green-600 font-medium">
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Успешно: {stats.success}
                            </span>
                            <span className="flex items-center text-red-500 font-medium">
                                <XCircle className="h-4 w-4 mr-1" />
                                Ошибок: {stats.error}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="flex flex-col h-[300px]">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">Журнал операций (Logs)</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto bg-muted/50 p-4 font-mono text-xs text-foreground rounded-b-xl border-t">
                    {logs.length === 0 ? (
                        <span className="text-muted-foreground">Ожидание запуска...</span>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className="mb-1">
                                <span className="text-muted-foreground mr-2">[{log.time}]</span>
                                <span className={
                                    log.type === 'error' ? 'text-red-600 font-medium' : 
                                    log.type === 'success' ? 'text-green-600 font-medium' : 'text-blue-600 font-medium'
                                }>
                                    {log.message}
                                </span>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </CardContent>
            </Card>
        </div>
    );
}
