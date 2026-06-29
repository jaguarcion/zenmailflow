"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  Loader2, 
  RefreshCcw, 
  Ban, 
  UserPlus, 
  MonitorOff, 
  Upload, 
  Activity,
  History
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ActionIcon = ({ type }) => {
  switch (type) {
    case 'ASSIGN_ACCOUNT':
      return <UserPlus className="h-4 w-4 text-green-500" />;
    case 'UNASSIGN_ACCOUNT':
      return <MonitorOff className="h-4 w-4 text-orange-500" />;
    case 'REPLACE_ACCOUNT':
      return <RefreshCcw className="h-4 w-4 text-blue-500" />;
    case 'BAN_ACCOUNT':
      return <Ban className="h-4 w-4 text-red-500" />;
    case 'UPLOAD_ACCOUNTS':
      return <Upload className="h-4 w-4 text-purple-500" />;
    case 'DELETE_ACCOUNT':
      return <Activity className="h-4 w-4 text-red-700" />;
    default:
      return <History className="h-4 w-4 text-gray-500" />;
  }
};

const ActionBadge = ({ type }) => {
  switch (type) {
    case 'ASSIGN_ACCOUNT':
      return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Выдача</Badge>;
    case 'UNASSIGN_ACCOUNT':
      return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Отвязка</Badge>;
    case 'REPLACE_ACCOUNT':
      return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Замена</Badge>;
    case 'BAN_ACCOUNT':
      return <Badge variant="destructive">Бан</Badge>;
    case 'UPLOAD_ACCOUNTS':
      return <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">Загрузка</Badge>;
    case 'DELETE_ACCOUNT':
      return <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">Удаление</Badge>;
    default:
      return <Badge variant="secondary">{type}</Badge>;
  }
};

const renderDescription = (text) => {
  if (!text) return text;
  const regex = /(@[a-zA-Z0-9_]+|(?:https?:\/\/)?t\.me\/[a-zA-Z0-9_]+)/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (part.match(regex)) {
      let username = part;
      if (part.startsWith('@')) {
        username = part.substring(1);
      } else {
        username = part.split('t.me/')[1];
      }
      return (
        <a 
          key={i} 
          href={`https://t.me/${username}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline font-medium"
        >
          {part.startsWith('@') ? part : `@${username}`}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

export default function AuditLogsTab({ token }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/logs?limit=200", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token]);

  if (loading && logs.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex justify-end">
        <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Последние события</CardTitle>
          <CardDescription>Отображаются последние 200 записей</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Журнал пока пуст
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Дата и время</TableHead>
                    <TableHead className="w-[150px]">Событие</TableHead>
                    <TableHead>Описание</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {format(new Date(log.created_at), "dd.MM.yyyy, HH:mm", { locale: ru })}
                      </TableCell>
                      <TableCell>
                        <ActionBadge type={log.action_type} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {renderDescription(log.description)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
