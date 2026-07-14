"use client";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Play, CheckCircle2, XCircle, RotateCcw, ListPlus } from "lucide-react";

const FIRST_NAMES = ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Charles", "Joseph", "Thomas", "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen", "Alex", "David", "Max", "Leo"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Walker", "Hall"];

function generateRandomName() {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    return { firstName, lastName };
}

export default function AutodeskInviterTab({ token }) {
    const [config, setConfig] = useState({
        tenantId: "63238795",
        invitedBy: "2S82WAKKQY6ZQB2X",
        groupId: "",
        authToken: "",
        cookieString: ""
    });
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);
    
    const [users, setUsers] = useState([]);
    const [emailsInput, setEmailsInput] = useState("");
    const [logs, setLogs] = useState([]);
    const [isInviting, setIsInviting] = useState(false);
    const [stats, setStats] = useState({ success: 0, error: 0 });
    const logsEndRef = useRef(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/autodesk/config', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.status === 'success' && data.config) {
                    setConfig(data.config);
                }
            } catch (err) {
                console.error("Failed to load config", err);
            }
            setIsConfigLoaded(true);
        };
        fetchConfig();
    }, [token]);

    useEffect(() => {
        if (isConfigLoaded) {
            fetch('/api/autodesk/config', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(config)
            }).catch(() => {});
        }
    }, [config, isConfigLoaded, token]);

    const handleConfigChange = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleLoadEmails = () => {
        const lines = emailsInput.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length === 0) {
            toast.error("Введите хотя бы один email");
            return;
        }

        const parsedUsers = lines.map(email => {
            const { firstName, lastName } = generateRandomName();
            return { email, firstName, lastName, status: 'pending' };
        });

        setUsers(parsedUsers);
        setStats({ success: 0, error: 0 });
        setLogs([{ type: 'info', message: `Успешно загружено ${parsedUsers.length} почт.` }]);
        toast.success(`К загрузке готово: ${parsedUsers.length} аккаунтов`);
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
        addLog('info', 'Отправка задачи на сервер...');
        
        try {
            const res = await fetch('/api/autodesk/tasks/start', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    config,
                    users
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                addLog('success', 'Фоновая задача успешно запущена! Вы можете закрыть эту вкладку.');
                toast.success('Фоновая задача запущена. Статус отображается в правом нижнем углу.');
                // Clear inputs
                setUsers([]);
                setEmailsInput('');
            } else {
                addLog('error', `Ошибка запуска задачи: ${data.error || 'неизвестно'}`);
                toast.error(`Ошибка: ${data.error || 'неизвестно'}`);
            }
        } catch (err) {
            addLog('error', `Ошибка сети: ${err.message}`);
            toast.error(`Ошибка сети: ${err.message}`);
        } finally {
            setIsInviting(false);
        }
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
                        <CardTitle className="flex justify-between items-center">
                            <span>Настройки API Autodesk</span>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                    const script = `(function(){console.log("Ожидаю API-запрос...");let found=false;function handleToken(token){if(found||!token.startsWith('Bearer '))return;found=true;console.log("=================================");console.log("ДАННЫЕ УСПЕШНО ПЕРЕХВАЧЕНЫ!");console.log("Authorization Token:\\n" + token);console.log("Cookie String:\\n" + document.cookie);console.log("=================================");alert("Токен и Cookie успешно перехвачены! Посмотрите в консоль.");}const originalOpen=XMLHttpRequest.prototype.open;const originalSetRequestHeader=XMLHttpRequest.prototype.setRequestHeader;XMLHttpRequest.prototype.open=function(){this._headers={};return originalOpen.apply(this,arguments);};XMLHttpRequest.prototype.setRequestHeader=function(header,value){if(header.toLowerCase()==='authorization'){handleToken(value);}return originalSetRequestHeader.apply(this,arguments);};const originalFetch=window.fetch;window.fetch=async function(){if(arguments[1]&&arguments[1].headers){let auth=null;if(arguments[1].headers instanceof Headers){auth=arguments[1].headers.get('authorization');}else if(Array.isArray(arguments[1].headers)){const h=arguments[1].headers.find(h=>h[0].toLowerCase()==='authorization');if(h)auth=h[1];}else{for(let key in arguments[1].headers){if(key.toLowerCase()==='authorization')auth=arguments[1].headers[key];}}if(auth)handleToken(auth);}return originalFetch.apply(this,arguments);};})();`;
                                    navigator.clipboard.writeText(script);
                                    toast.success("Скрипт перехвата скопирован!");
                                }}
                            >
                                Копировать скрипт (F12)
                            </Button>
                        </CardTitle>
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
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Group ID (опционально)</label>
                            <Input name="groupId" value={config.groupId || ''} onChange={handleConfigChange} placeholder="Например: 1234567" />
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
                        <CardTitle>Список почт</CardTitle>
                        <CardDescription>Вставьте список email адресов (каждый с новой строки). Имена будут сгенерированы автоматически.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea 
                            className="min-h-[160px] font-mono text-sm" 
                            placeholder="alt.hk_cob85ha1@yopmail.com&#10;alt.bm-07m979d@yopmail.com"
                            value={emailsInput}
                            onChange={e => setEmailsInput(e.target.value)}
                            disabled={isInviting}
                        />

                        <div className="flex items-center justify-between">
                            <Button variant="secondary" onClick={handleLoadEmails} disabled={isInviting || !emailsInput.trim()}>
                                <ListPlus className="h-4 w-4 mr-2" />
                                Загрузить в очередь
                            </Button>
                            
                            {users.length > 0 && (
                                <p className="text-sm font-medium text-green-600">
                                    В очереди: {users.length}
                                </p>
                            )}
                        </div>

                        <div className="flex gap-2 pt-2 border-t mt-4">
                            <Button 
                                onClick={startInvites} 
                                disabled={isInviting || users.length === 0}
                                className="flex-1"
                            >
                                {isInviting ? <RotateCcw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                {isInviting ? "Запуск задачи..." : "Начать приглашения"}
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
