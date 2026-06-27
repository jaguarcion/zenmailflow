"use client";

import { useEffect, useState, use } from 'react';
import Head from 'next/head';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy, RefreshCw, Mail, PartyPopper } from "lucide-react";

export default function ClientAdobePage({ params }) {
    const unwrappedParams = use(params);
    const id = unwrappedParams.id;
    
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [replacing, setReplacing] = useState(false);

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
                alert(json.error || 'Ошибка при замене аккаунта');
            }
        } catch (e) {
            alert(e.message);
        } finally {
            setReplacing(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const copyAll = () => {
        if (!data) return;
        const text = `Логин: ${data.email}\nПароль: ${data.adobe_password}`;
        copyToClipboard(text);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Card className="w-full max-w-md bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl">
                    <CardContent className="pt-6 text-center">
                        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-destructive mb-2">Ошибка</h2>
                        <p className="text-slate-300">{error || 'Аккаунт не найден'}</p>
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
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-8 flex justify-center items-start selection:bg-blue-500/30">
            <Head>
                <title>Ваш аккаунт Adobe</title>
            </Head>

            <div className="w-full max-w-2xl space-y-6 mt-4 sm:mt-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {/* Header */}
                <div className="text-center space-y-4 mb-8">
                    <div className="inline-flex p-4 rounded-full bg-gradient-to-tr from-purple-500/20 to-blue-500/20 mb-2 shadow-lg shadow-blue-500/10 ring-1 ring-white/10">
                        <PartyPopper className="w-8 h-8 text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        Ваш аккаунт Adobe
                    </h1>
                    <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
                        Сохраните ссылку на эту страницу, чтобы не потерять доступ к аккаунту. Коды для подтверждения входа приходят ниже. После запроса кода подождите 20 секунд и нажмите «Обновить».
                    </p>
                </div>

                {/* Blocked Alert */}
                {data.status === 'blocked' && (
                    <Alert variant="destructive" className="bg-red-950/40 border-red-900/50 backdrop-blur-md flex flex-col sm:flex-row items-center gap-4 py-4 px-5">
                        <div className="flex-1 flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            <div>
                                <AlertTitle className="text-red-400 font-bold mb-1">Аккаунт заблокирован</AlertTitle>
                                <AlertDescription className="text-red-300/80 text-xs">
                                    К сожалению, этот аккаунт был заблокирован Adobe.
                                </AlertDescription>
                            </div>
                        </div>
                        <Button 
                            variant="destructive"
                            onClick={handleReplace}
                            disabled={replacing}
                            className="w-full sm:w-auto shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] transition-all font-semibold"
                        >
                            {replacing ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Замена...</> : 'Заменить аккаунт'}
                        </Button>
                    </Alert>
                )}

                {/* Credentials Card */}
                <Card className="bg-slate-900/60 border-slate-800/60 backdrop-blur-xl shadow-2xl overflow-hidden">
                    <CardContent className="p-6 sm:p-8">
                        <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-5 flex items-center gap-2">
                            <Mail className="w-4 h-4" /> Данные для входа
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-black/40 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                                <code className="font-mono text-blue-300 text-sm break-all">{data.email}</code>
                                <Button variant="secondary" size="sm" onClick={() => copyToClipboard(data.email)} className="bg-white/5 hover:bg-white/10 border-white/5 text-slate-300">
                                    <Copy className="w-3 h-3 mr-2" /> Копировать
                                </Button>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-black/40 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                                <code className="font-mono text-purple-300 text-sm break-all">{data.adobe_password || 'Нет пароля'}</code>
                                <Button variant="secondary" size="sm" onClick={() => copyToClipboard(data.adobe_password || '')} className="bg-white/5 hover:bg-white/10 border-white/5 text-slate-300">
                                    <Copy className="w-3 h-3 mr-2" /> Копировать
                                </Button>
                            </div>
                        </div>

                        <Button 
                            onClick={copyAll}
                            className="mt-6 w-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 text-blue-300 border border-blue-500/20 h-12 rounded-xl transition-all font-medium"
                        >
                            <Copy className="w-4 h-4 mr-2" /> Скопировать всё
                        </Button>
                    </CardContent>
                </Card>

                {/* Messages Card */}
                <Card className="bg-slate-900/60 border-slate-800/60 backdrop-blur-xl shadow-2xl">
                    <CardContent className="p-6 sm:p-8">
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Последние 5 писем</div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => fetchData(true)}
                                disabled={refreshing}
                                className="bg-blue-950/30 border-blue-900/50 text-blue-400 hover:bg-blue-900/40 hover:text-blue-300 h-8"
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
                                data.messages.map((msg) => (
                                    <div key={msg.uid} className="p-4 bg-black/30 rounded-xl border border-white/5 hover:border-white/10 transition-colors flex flex-col gap-2">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[11px] font-mono text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded">
                                                {typeof msg.from === 'string' ? msg.from : (msg.from?.[0]?.address || 'Adobe')}
                                            </span>
                                            <span className="text-[11px] text-slate-500">
                                                {msg.date}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="text-sm font-medium text-slate-300">{msg.subject}</span>
                                            {extractCode(msg) !== 'N/A' && (
                                                <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/20 font-bold px-2 py-0.5 text-xs">
                                                    {extractCode(msg)}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
