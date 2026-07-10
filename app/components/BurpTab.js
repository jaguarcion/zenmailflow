"use client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Mail, RefreshCw, Paperclip } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function BurpTab({ token }) {
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    
    // Inbox Modal State
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    const fetchAddresses = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/burp', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'success') {
                setAddresses(data.data);
            } else {
                toast.error(data.error || 'Failed to fetch addresses');
            }
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAddresses();
    }, []);

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            const res = await fetch('/api/burp', { 
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'success') {
                toast.success('Address generated successfully! DNS propagation might take ~1 min.');
                fetchAddresses();
            } else {
                toast.error(data.error || 'Failed to generate');
            }
        } catch (e) {
            toast.error(e.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleDelete = async (address) => {
        if (!confirm(`Are you sure you want to delete ${address.address}?`)) return;
        
        try {
            const res = await fetch('/api/burp', {
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id: address.id, label: address.label, domain: address.domain })
            });
            const data = await res.json();
            if (data.status === 'success') {
                toast.success('Address deleted');
                setAddresses(prev => prev.filter(a => a.id !== address.id));
            } else {
                toast.error(data.error || 'Failed to delete');
            }
        } catch (e) {
            toast.error(e.message);
        }
    };

    const openInbox = async (address) => {
        setSelectedAddress(address);
        setMessages([]);
        setLoadingMessages(true);
        
        try {
            const res = await fetch(`/api/burp/messages?addressId=${address.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'success') {
                setMessages(data.data);
            } else {
                toast.error(data.error || 'Failed to fetch messages');
            }
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoadingMessages(false);
        }
    };

    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Mail className="w-5 h-5 text-primary" /> Burp (Disposable Mail)
                    </CardTitle>
                    <CardDescription>Generate disposable email addresses that route to this server.</CardDescription>
                </div>
                <div>
                    <Button onClick={handleGenerate} disabled={generating}>
                        {generating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        Generate New
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0 relative">
                <div className="absolute inset-0 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                            <TableRow>
                                <TableHead>Address</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : addresses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-20 text-muted-foreground">
                                        <Mail className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                                        <p>No disposable addresses generated yet.</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                addresses.map((addr) => (
                                    <TableRow key={addr.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => openInbox(addr)}>
                                        <TableCell className="font-mono text-sm font-medium text-primary">
                                            {addr.address}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(addr.created_at + 'Z').toLocaleString('ru-RU')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={(e) => { e.stopPropagation(); handleDelete(addr); }}
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <Dialog open={!!selectedAddress} onOpenChange={(open) => !open && setSelectedAddress(null)}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-2 border-b">
                        <DialogTitle className="flex items-center gap-2">
                            <Mail className="w-5 h-5 text-primary" /> Inbox: <span className="font-mono">{selectedAddress?.address}</span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto p-6 bg-muted/30">
                        {loadingMessages ? (
                            <div className="flex flex-col gap-4">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="text-center py-20 text-muted-foreground">
                                <p>No emails received yet.</p>
                                <p className="text-xs mt-2">DNS propagation might take up to a minute after creation.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {messages.map((msg) => (
                                    <Card key={msg.id} className="shadow-sm">
                                        <CardHeader className="py-3 px-4 border-b bg-muted/10">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="truncate">
                                                    <div className="font-semibold text-sm truncate">{msg.subject || '(No Subject)'}</div>
                                                    <div className="text-xs text-muted-foreground truncate">From: {msg.from_address}</div>
                                                </div>
                                                <div className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {new Date(msg.received_at + 'Z').toLocaleString('ru-RU')}
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-4 text-sm whitespace-pre-wrap font-mono overflow-auto max-h-[300px]">
                                            {msg.text_content || 'No text content'}
                                        </CardContent>
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className="px-4 py-3 border-t bg-muted/20 flex flex-wrap gap-2">
                                                {msg.attachments.map((att, i) => (
                                                    <a 
                                                        key={i} 
                                                        href={att.url} 
                                                        download={att.filename}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background border rounded-md text-xs font-medium hover:bg-muted transition-colors"
                                                    >
                                                        <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                                                        <span className="truncate max-w-[150px]">{att.filename}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
