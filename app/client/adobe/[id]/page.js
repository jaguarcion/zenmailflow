"use client";

import { useEffect, useState, use } from 'react';
import { toast } from 'sonner';
import Head from 'next/head';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy, RefreshCw, Mail, Moon, Sun } from "lucide-react";

export default function ClientAdobePage({ params }) {
    const unwrappedParams = use(params);
    const id = unwrappedParams.id;
    
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [replacing, setReplacing] = useState(false);
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') setIsDark(false);
    }, []);

    const toggleTheme = () => {
        setIsDark(!isDark);
        localStorage.setItem('theme', !isDark ? 'dark' : 'light');
    };

    const fetchData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const res = await fetch(`/api/client/adobe/${id}`);
            const json = await res.json();
            if (json.error) {
                setError(json.error);
            } else {
                setData(json);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        document.title = "Ваш аккаунт Adobe";
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleReplace = async () => {
        if (!confirm('Вы уверены, что хотите заменить заблокированный аккаунт на новый?')) return;
        setReplacing(true);
        try {
            const res = await fetch(`/api/client/adobe/${id}/replace`, {
                method: 'POST'
            });
            const json = await res.json();
            if (json.success) {
                window.location.href = `/client/adobe/${json.new_id}`;
            } else {
                toast.error(json.error || 'Ошибка при замене аккаунта');
            }
        } catch (e) {
            toast.error(e.message);
        } finally {
            setReplacing(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success("Данные скопированы в буфер обмена");
    };

    const copyAll = () => {
        if (!data) return;
        const text = `Логин: ${data.email}\nПароль: ${data.adobe_password}`;
        copyToClipboard(text);
    };

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <Card className={`w-full max-w-md shadow-2xl backdrop-blur-xl ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                    <CardContent className="pt-6 text-center">
                        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-destructive mb-2">Ошибка</h2>
                        <p className={isDark ? "text-slate-300" : "text-slate-600"}>{error || 'Аккаунт не найден'}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const extractCode = (msg) => {
        if (msg.code) return msg.code;
        const subjectMatch = msg.subject?.match(/\b\d{6}\b/);
        if (subjectMatch) return subjectMatch[0];
        const htmlMatch = msg.message?.match(/>(\d{6})</);
        if (htmlMatch) return htmlMatch[1];
        return 'N/A';
    };

    return (
        <div className={`min-h-screen font-sans p-4 sm:p-8 flex justify-center items-start selection:bg-blue-500/30 transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
            <Head>
                <title>Ваш аккаунт Adobe</title>
            </Head>

            <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-10">
                <Button variant="ghost" size="icon" onClick={toggleTheme} className={isDark ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-500 hover:text-black hover:bg-slate-200"}>
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </Button>
            </div>

            <div className="w-full max-w-2xl space-y-6 mt-4 sm:mt-10 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
                
                {/* Header */}
                <div className="text-center space-y-4 mb-8">
                    <div className="inline-flex justify-center items-center mb-2">
                        <img src="/logo.png" alt="Logo" className="w-32 h-32 object-cover rounded-full shadow-lg ring-1 ring-black/10 dark:ring-white/10" />
                    </div>
                    <h1 className={`text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${isDark ? 'text-white from-white to-slate-400' : 'from-slate-800 to-slate-500'}`}>
                        Ваш аккаунт Adobe
                    </h1>
                    <p className={`text-sm max-w-lg mx-auto leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Сохраните ссылку на эту страницу, чтобы не потерять доступ к аккаунту. Коды для подтверждения входа приходят ниже. После запроса кода подождите 20 секунд и нажмите «Обновить».
                    </p>
                </div>

                {/* Blocked Alert */}
                {data.status === 'blocked' && (
                    <Alert variant="destructive" className={`backdrop-blur-md flex flex-col sm:flex-row items-center gap-4 py-4 px-5 ${isDark ? 'bg-red-950/40 border-red-900/50' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex-1 flex items-center gap-3">
                            <AlertTriangle className={`h-5 w-5 ${isDark ? 'text-red-500' : 'text-red-600'}`} />
                            <div>
                                <AlertTitle className={`font-bold mb-1 ${isDark ? 'text-red-400' : 'text-red-700'}`}>Аккаунт заблокирован</AlertTitle>
                                <AlertDescription className={`text-xs ${isDark ? 'text-red-300/80' : 'text-red-600'}`}>
                                    К сожалению, этот аккаунт был заблокирован Adobe.
                                </AlertDescription>
                            </div>
                        </div>
                        <Button 
                            variant="destructive"
                            onClick={handleReplace}
                            disabled={replacing}
                            className={`w-full sm:w-auto transition-all font-semibold ${isDark ? 'shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)]' : 'shadow-sm'}`}
                        >
                            {replacing ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Замена...</> : 'Заменить аккаунт'}
                        </Button>
                    </Alert>
                )}

                {/* Credentials Card */}
                <Card className={`backdrop-blur-xl shadow-2xl overflow-hidden transition-colors duration-300 ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white/80 border-slate-200/60'}`}>
                    <CardContent className="p-6 sm:p-8">
                        <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-5 flex items-center gap-2">
                            <Mail className="w-4 h-4" /> Данные для входа Adobe
                        </div>
                        
                        <div className="space-y-4">
                            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${isDark ? 'bg-black/40 border-white/5 hover:border-white/10' : 'bg-slate-100/50 border-slate-200 hover:border-slate-300'}`}>
                                <div>
                                    <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Логин</div>
                                    <code className={`font-mono text-sm break-all ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{data.email}</code>
                                </div>
                                <Button variant="secondary" size="sm" onClick={() => copyToClipboard(data.email)} className={isDark ? "bg-white/5 hover:bg-white/10 border-white/5 text-slate-300" : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm"}>
                                    <Copy className="w-3 h-3 mr-2" /> Копировать
                                </Button>
                            </div>
                            
                            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${isDark ? 'bg-black/40 border-white/5 hover:border-white/10' : 'bg-slate-100/50 border-slate-200 hover:border-slate-300'}`}>
                                <div>
                                    <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Пароль</div>
                                    <code className={`font-mono text-sm break-all ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{data.adobe_password || 'Нет пароля'}</code>
                                </div>
                                <Button variant="secondary" size="sm" onClick={() => copyToClipboard(data.adobe_password || '')} className={isDark ? "bg-white/5 hover:bg-white/10 border-white/5 text-slate-300" : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm"}>
                                    <Copy className="w-3 h-3 mr-2" /> Копировать
                                </Button>
                            </div>
                        </div>

                        <Button 
                            onClick={copyAll}
                            className={`mt-6 w-full border h-12 rounded-xl transition-all font-medium bg-gradient-to-r ${isDark ? 'from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 text-blue-300 border-blue-500/20' : 'from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 text-blue-700 border-blue-200 shadow-sm'}`}
                        >
                            <Copy className="w-4 h-4 mr-2" /> Скопировать всё
                        </Button>
                    </CardContent>
                </Card>

                {/* Messages Card */}
                <Card className={`backdrop-blur-xl shadow-2xl transition-colors duration-300 ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white/80 border-slate-200/60'}`}>
                    <CardContent className="p-6 sm:p-8">
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Последние 5 писем</div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => fetchData(true)}
                                disabled={refreshing}
                                className={`h-8 ${isDark ? 'bg-blue-950/30 border-blue-900/50 text-blue-400 hover:bg-blue-900/40 hover:text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700'}`}
                            >
                                <RefreshCw className={`w-3 h-3 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                                {refreshing ? 'Обновление...' : 'Обновить'}
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {data.messages.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 text-sm">
                                    Письма с кодами пока не приходили.
                                </div>
                            ) : (
                                data.messages.map((msg) => {
                                    const code = extractCode(msg);
                                    return (
                                        <div key={msg.uid} className={`p-4 rounded-xl border transition-colors flex flex-col gap-2 ${isDark ? 'bg-black/30 border-white/5 hover:border-white/10' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${isDark ? 'text-slate-500 bg-slate-900/50' : 'text-slate-600 bg-slate-100'}`}>
                                                    {typeof msg.from === 'string' ? msg.from : (msg.from?.[0]?.address || 'Adobe')}
                                                </span>
                                                <span className="text-[11px] text-slate-500">
                                                    {msg.date ? `${msg.date} МСК` : ''}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{msg.subject}</span>
                                                {code !== 'N/A' && (
                                                    <Badge 
                                                        variant="destructive" 
                                                        className={`font-bold px-3 py-1 text-sm cursor-pointer transition-colors ${isDark ? 'bg-red-500/20 text-red-400 border-red-500/20 hover:bg-red-500/30' : 'bg-red-100 text-red-600 border-red-200 hover:bg-red-200'}`}
                                                        onClick={() => copyToClipboard(code)}
                                                        title="Скопировать код"
                                                    >
                                                        {code}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
