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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Журнал действий</h2>
          <p className="text-muted-foreground">История операций с аккаунтами и клиентами</p>
        </div>
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
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
              {logs.map((log) => (
                <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 group-[.is-active]:bg-white group-[.is-active]:border-slate-200 shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <ActionIcon type={log.action_type} />
                  </div>
                  
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <ActionBadge type={log.action_type} />
                      <time className="text-xs font-medium text-slate-500">
                        {format(new Date(log.created_at), "dd MMM yyyy, HH:mm", { locale: ru })}
                      </time>
                    </div>
                    <div className="text-sm text-slate-700 leading-relaxed">
                      {log.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
