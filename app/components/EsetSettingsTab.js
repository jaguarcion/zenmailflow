"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Settings, Play } from "lucide-react";

export default function EsetSettingsTab({ token }) {
    const [config, setConfig] = useState({
        proxy: "",
        emailProvider: "migadu",
        migaduUser: "",
        migaduToken: "",
        migaduDomain: "",
        concurrency: 2,
        autopostChannel: "",
        autopostCron: "0 12 * * *",
        autopostCount: 5
    });
    const [loading, setLoading] = useState(false);
    const [triggerLoading, setTriggerLoading] = useState(false);
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/eset/config', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.status === 'success' && data.config) {
                    setConfig({
                        proxy: data.config.proxy || "",
                        emailProvider: data.config.emailProvider || "migadu",
                        migaduUser: data.config.migaduUser || "",
                        migaduToken: data.config.migaduToken || "",
                        migaduDomain: data.config.migaduDomain || "",
                        concurrency: data.config.concurrency || 2,
                        autopostChannel: data.config.autopostChannel || "",
                        autopostCron: data.config.autopostCron || "0 12 * * *",
                        autopostCount: data.config.autopostCount || 5
                    });
                }
            } catch (err) {
                console.error("Failed to load eset config", err);
            }
            setIsConfigLoaded(true);
        };
        fetchConfig();
    }, [token]);

    const handleConfigChange = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleProviderChange = (val) => {
        setConfig({ ...config, emailProvider: val });
    };

    const saveConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/eset/config', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(config)
            });
            const data = await res.json();
            if (data.status === 'success') {
                toast.success("Настройки успешно сохранены!");
            } else {
                toast.error("Ошибка при сохранении: " + data.error);
            }
        } catch (err) {
            toast.error("Ошибка сети при сохранении настроек.");
        } finally {
            setLoading(false);
        }
    };

    const triggerAutopost = async () => {
        setTriggerLoading(true);
        try {
            const res = await fetch('/api/eset/autopost/trigger', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.status === 'success') {
                toast.success(`Автопостинг успешно выполнен! Отправлено ключей: ${data.keysCount}`);
            } else {
                toast.error("Ошибка автопостинга: " + data.error);
            }
        } catch (err) {
            toast.error("Ошибка сети при запуске автопостинга.");
        } finally {
            setTriggerLoading(false);
        }
    };

    if (!isConfigLoaded) return <div className="p-8 text-center text-muted-foreground animate-pulse">Загрузка настроек...</div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5 text-primary"/> Настройки ESET Генератора</CardTitle>
                    <CardDescription>Настройте прокси-серверы и провайдера временных почт для обхода капчи и регистрации аккаунтов.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Сетевые настройки</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Прокси (Поддерживается ротация)</label>
                                <Input 
                                    name="proxy" 
                                    value={config.proxy} 
                                    onChange={handleConfigChange} 
                                    placeholder="http://user:pass@1.2.3.4:443[https://url-for-ip-change]" 
                                />
                                <p className="text-xs text-muted-foreground">Формат: <code>протокол://логин:пароль@хост:порт[URL_СМЕНЫ_IP]</code>. Либо через запятую несколько прокси.</p>
                            </div>
                            <div className="space-y-2 max-w-[200px]">
                                <label className="text-sm font-medium">Потоки генерации</label>
                                <Input 
                                    type="number"
                                    name="concurrency" 
                                    min="1"
                                    max="20"
                                    value={config.concurrency} 
                                    onChange={handleConfigChange} 
                                    placeholder="2" 
                                />
                                <p className="text-xs text-muted-foreground">Количество одновременно создаваемых аккаунтов (1-20).</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Почтовый провайдер</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Провайдер почт</label>
                                <Select value={config.emailProvider} onValueChange={handleProviderChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Выберите провайдера" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="migadu">Migadu (Рекомендуется)</SelectItem>
                                        <SelectItem value="mailtm">Mail.tm (Бесплатно, часто блокируют)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {config.emailProvider === 'migadu' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg border">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Migadu User (Admin Email)</label>
                                    <Input 
                                        name="migaduUser" 
                                        value={config.migaduUser} 
                                        onChange={handleConfigChange} 
                                        placeholder="admin@yourdomain.com" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Migadu API Token</label>
                                    <Input 
                                        name="migaduToken" 
                                        type="password"
                                        value={config.migaduToken} 
                                        onChange={handleConfigChange} 
                                        placeholder="Migadu API token" 
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-medium">Migadu Domain</label>
                                    <Input 
                                        name="migaduDomain" 
                                        value={config.migaduDomain} 
                                        onChange={handleConfigChange} 
                                        placeholder="yourdomain.com" 
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Telegram Автопостинг</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-lg border">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">ID Канала</label>
                                <Input 
                                    name="autopostChannel" 
                                    value={config.autopostChannel} 
                                    onChange={handleConfigChange} 
                                    placeholder="@eset_free_keys" 
                                />
                                <p className="text-xs text-muted-foreground">Например: @channelname</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Расписание (Cron)</label>
                                <Input 
                                    name="autopostCron" 
                                    value={config.autopostCron} 
                                    onChange={handleConfigChange} 
                                    placeholder="0 12 * * *" 
                                />
                                <p className="text-xs text-muted-foreground">Формат: cron (по умолч. 0 12 * * *)</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Количество ключей</label>
                                <Input 
                                    type="number"
                                    name="autopostCount" 
                                    min="1"
                                    max="50"
                                    value={config.autopostCount} 
                                    onChange={handleConfigChange} 
                                    placeholder="5" 
                                />
                                <p className="text-xs text-muted-foreground">Сколько ключей будет в одном посте</p>
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button variant="outline" onClick={triggerAutopost} disabled={triggerLoading} className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700">
                                <Play className="w-4 h-4 mr-2" /> 
                                {triggerLoading ? "Выполняется..." : "Запустить сейчас"}
                            </Button>
                        </div>
                    </div>

                    <Button onClick={saveConfig} disabled={loading} className="w-full sm:w-auto">
                        <Save className="w-4 h-4 mr-2" /> {loading ? "Сохранение..." : "Сохранить настройки"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
