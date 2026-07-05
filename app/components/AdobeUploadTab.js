"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Eye, History, Copy, Check } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

export default function AdobeUploadTab({ token }) {
    const [uploadText, setUploadText] = useState("");
    const [loading, setLoading] = useState(false);
    const [uploads, setUploads] = useState([]);
    const [loadingUploads, setLoadingUploads] = useState(true);
    
    // Modal state
    const [selectedUploadId, setSelectedUploadId] = useState(null);
    const [uploadAccounts, setUploadAccounts] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [loadingAccounts, setLoadingAccounts] = useState(false);

    const fetchUploads = async () => {
        try {
            setLoadingUploads(true);
            const res = await fetch("/api/adobe/uploads", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setUploads(data.data);
            }
        } catch (e) {
            console.error("Failed to fetch uploads");
        } finally {
            setLoadingUploads(false);
        }
    };

    useEffect(() => {
        fetchUploads();
    }, [token]);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadText.trim()) return;
        setLoading(true);
        try {
            const res = await fetch("/api/adobe/upload", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ text: uploadText })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Добавлено: ${data.added}, Ошибок: ${data.errors}`);
                setUploadText("");
                fetchUploads();
            } else {
                toast.error(data.error || "Ошибка при загрузке");
            }
        } catch (e) {
            toast.error("Ошибка при загрузке аккаунтов");
        }
        setLoading(false);
    };

    const handleViewAccounts = async (uploadId) => {
        setSelectedUploadId(uploadId);
        setUploadAccounts([]);
        setModalOpen(true);
        setLoadingAccounts(true);
        try {
            const res = await fetch(`/api/adobe/uploads/${uploadId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setUploadAccounts(data.data);
            }
        } catch (e) {
            console.error("Failed to fetch upload accounts");
        } finally {
            setLoadingAccounts(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Загрузка аккаунтов Adobe</CardTitle>
                    <CardDescription>Формат: email | password | adobe_password | refresh_token | device_id</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpload} className="flex flex-col gap-4">
                        <textarea 
                            rows={5} 
                            value={uploadText} 
                            onChange={e => setUploadText(e.target.value)} 
                            required 
                            placeholder="test@test.com | pass | adobe | token | deviceid..."
                            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                        />
                        <Button type="submit" disabled={loading || !uploadText.trim()} className="w-fit">
                            <Upload className="w-4 h-4 mr-2" />
                            {loading ? 'Загрузка...' : 'Загрузить аккаунты'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="w-5 h-5 text-muted-foreground" />
                        История загрузок
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Дата загрузки</TableHead>
                                    <TableHead>Количество</TableHead>
                                    <TableHead className="text-right">Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingUploads ? (
                                    [...Array(3)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-16 rounded-md" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-24 float-right" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : uploads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">История загрузок пуста.</TableCell>
                                    </TableRow>
                                ) : (
                                    uploads.map((upload) => (
                                        <TableRow key={upload.id}>
                                            <TableCell className="font-medium">#{upload.id}</TableCell>
                                            <TableCell>
                                                {new Date(upload.created_at).toLocaleString('ru-RU')}
                                            </TableCell>
                                            <TableCell>
                                                <span className="bg-primary/10 text-primary font-semibold px-2 py-1 rounded-md text-xs">
                                                    {upload.accounts_count} шт.
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onClick={() => handleViewAccounts(upload.id)}>
                                                    <Eye className="w-4 h-4 mr-2" /> Просмотр
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="w-[95vw] sm:max-w-[90vw] md:max-w-[1200px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Аккаунты из загрузки #{selectedUploadId}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto mt-4 border rounded-md">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0">
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Pass Email</TableHead>
                                    <TableHead>Pass Adobe</TableHead>
                                    <TableHead>Token</TableHead>
                                    <TableHead>Device ID</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingAccounts ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-16 float-right" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : uploadAccounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            Нет аккаунтов.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    uploadAccounts.map(acc => (
                                        <TableRow key={acc.id}>
                                            <TableCell className="font-mono text-xs max-w-[150px] truncate" title={acc.email}>{acc.email}</TableCell>
                                            <TableCell className="font-mono text-xs max-w-[100px] truncate" title={acc.password}>{acc.password}</TableCell>
                                            <TableCell className="font-mono text-xs max-w-[100px] truncate" title={acc.adobe_password}>{acc.adobe_password}</TableCell>
                                            <TableCell className="font-mono text-xs max-w-[150px] truncate" title={acc.refresh_token}>{acc.refresh_token}</TableCell>
                                            <TableCell className="font-mono text-xs max-w-[100px] truncate" title={acc.device_id}>{acc.device_id}</TableCell>
                                            <TableCell>
                                                {acc.status === 'active' ? (
                                                    <span className="text-green-500 font-semibold text-xs">Активен</span>
                                                ) : (
                                                    <span className="text-red-500 font-semibold text-xs">Блок</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right p-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`${acc.email} | ${acc.password} | ${acc.adobe_password} | ${acc.refresh_token} | ${acc.device_id}`);
                                                        toast.success("Данные скопированы в буфер обмена");
                                                    }}
                                                >
                                                    <Copy className="w-3 h-3 mr-1" /> Всё
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
