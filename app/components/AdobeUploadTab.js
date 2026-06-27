"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Eye, History } from "lucide-react";

export default function AdobeUploadTab({ token }) {
    const [uploadText, setUploadText] = useState("");
    const [loading, setLoading] = useState(false);
    const [uploads, setUploads] = useState([]);
    
    // Modal state
    const [selectedUploadId, setSelectedUploadId] = useState(null);
    const [uploadAccounts, setUploadAccounts] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchUploads = async () => {
        try {
            const res = await fetch("/api/adobe/uploads", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setUploads(data.data);
            }
        } catch (e) {
            console.error("Failed to fetch uploads");
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
                alert(`Добавлено: ${data.added}, Ошибок: ${data.errors}`);
                setUploadText("");
                fetchUploads();
            } else {
                alert(data.error);
            }
        } catch (e) {
            alert("Error uploading accounts");
        }
        setLoading(false);
    };

    const handleViewAccounts = async (uploadId) => {
        setSelectedUploadId(uploadId);
        setUploadAccounts([]);
        setModalOpen(true);
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
                    {uploads.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-md border border-dashed">
                            История загрузок пуста.
                        </div>
                    ) : (
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
                                    {uploads.map((upload) => (
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
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Аккаунты из загрузки #{selectedUploadId}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto mt-4 border rounded-md">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0">
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Adobe Password</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {uploadAccounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                            Загрузка аккаунтов...
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    uploadAccounts.map(acc => (
                                        <TableRow key={acc.id}>
                                            <TableCell className="font-mono text-sm">{acc.email}</TableCell>
                                            <TableCell className="font-mono text-sm">{acc.adobe_password}</TableCell>
                                            <TableCell>
                                                {acc.status === 'active' ? (
                                                    <span className="text-green-500 font-semibold text-xs">Активен</span>
                                                ) : (
                                                    <span className="text-red-500 font-semibold text-xs">Блок</span>
                                                )}
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
