"use client";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { Send, User } from "lucide-react";

export default function SupportTab({ token }) {
    const [threads, setThreads] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const getClientName = (c) => {
        if (c.telegram_first_name || c.telegram_last_name) {
            return [c.telegram_first_name, c.telegram_last_name].filter(Boolean).join(' ');
        }
        if (c.telegram_username) return `@${c.telegram_username}`;
        if (c.telegram) return c.telegram;
        if (c.email) return c.email;
        return `Клиент #${c.id}`;
    };

    const fetchThreads = async () => {
        try {
            const res = await fetch("/api/support", { headers: { "Authorization": `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) {
                setThreads(data.data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchMessages = async (clientId) => {
        try {
            const res = await fetch(`/api/support?client_id=${clientId}`, { headers: { "Authorization": `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) {
                setMessages(data.data);
                // After fetching, refresh threads to clear unread badges
                fetchThreads();
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchThreads();
        const interval = setInterval(() => {
            fetchThreads();
            if (selectedClient) {
                fetchMessages(selectedClient.id);
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [token, selectedClient]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSelectClient = (client) => {
        setSelectedClient(client);
        fetchMessages(client.id);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedClient) return;
        
        setLoading(true);
        try {
            const res = await fetch("/api/support", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ client_id: selectedClient.id, message: newMessage })
            });
            if (res.ok) {
                setNewMessage("");
                fetchMessages(selectedClient.id);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
            <Card className="md:col-span-1 flex flex-col h-full overflow-hidden">
                <CardHeader className="pb-3 border-b">
                    <CardTitle>Диалоги</CardTitle>
                    <CardDescription>Клиенты, написавшие в поддержку</CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto">
                    {threads.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">Нет активных диалогов</div>
                    ) : (
                        threads.map(t => (
                            <div 
                                key={t.id}
                                onClick={() => handleSelectClient(t)}
                                className={`p-4 border-b cursor-pointer transition-colors hover:bg-muted/50 ${selectedClient?.id === t.id ? 'bg-muted/50' : ''}`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold text-sm truncate">{getClientName(t)}</span>
                                    {t.unread_count > 0 && (
                                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{t.unread_count}</Badge>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                    {new Date(t.last_message_time).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            <Card className="md:col-span-2 flex flex-col h-full overflow-hidden">
                {selectedClient ? (
                    <>
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <User className="w-5 h-5" />
                                {getClientName(selectedClient)}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 flex flex-col overflow-hidden relative">
                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="space-y-4">
                                    {messages.map((m, idx) => {
                                        const isAdmin = m.sender === 'admin';
                                        return (
                                            <div key={idx} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                                                <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isAdmin ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'}`}>
                                                    <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground mt-1 mx-1">
                                                    {new Date(m.created_at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>
                            <div className="p-4 border-t bg-background">
                                <form onSubmit={handleSendMessage} className="flex gap-2">
                                    <Input 
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        placeholder="Введите сообщение..."
                                        className="flex-1"
                                        disabled={loading}
                                    />
                                    <Button type="submit" disabled={loading || !newMessage.trim()}>
                                        <Send className="w-4 h-4" />
                                    </Button>
                                </form>
                            </div>
                        </CardContent>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Выберите диалог слева
                    </div>
                )}
            </Card>
        </div>
    );
}
