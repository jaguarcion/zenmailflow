"use client";

import { useState, useEffect } from "react";
import AdobeListTab from "./components/AdobeListTab";
import AdobeUploadTab from "./components/AdobeUploadTab";
import ClientsTab from "./components/ClientsTab";
import DashboardTab from "./components/DashboardTab";
import AuditLogsTab from "./components/AuditLogsTab";
import GlobalSearch from "./components/GlobalSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LogOut, Download, Trash2, Mail, Users, Monitor, Zap, History, Menu, LayoutDashboard, ScrollText } from "lucide-react";

export default function Home() {
  const [token, setToken] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [freshEmails, setFreshEmails] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [error, setError] = useState(null);
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState("");

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [selectedFresh, setSelectedFresh] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState([]);

  useEffect(() => {
    const savedToken = localStorage.getItem("zenmail_token");
    const savedTab = localStorage.getItem("zenmail_active_tab");
    if (savedTab) {
      setActiveTab(savedTab);
    }
    if (savedToken) {
      setToken(savedToken);
      fetch("/api/history", { headers: { "Authorization": `Bearer ${savedToken}` } })
        .then(res => {
          if (res.ok) {
            setIsLoggedIn(true);
            fetchDomains(savedToken);
            fetchHistory(savedToken);
            fetchClients(savedToken);
          } else {
            localStorage.removeItem("zenmail_token");
            setToken("");
          }
          setIsCheckingAuth(false);
        })
        .catch(() => setIsCheckingAuth(false));
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  const changeTab = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem("zenmail_active_tab", tabId);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (token.trim()) {
      try {
        const res = await fetch("/api/history", { headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) {
          localStorage.setItem("zenmail_token", token);
          setIsLoggedIn(true);
          fetchDomains(token);
          fetchHistory(token);
          fetchClients(token);
          setError(null);
        } else {
          setError("Неверный мастер-токен");
        }
      } catch (err) {
        setError("Ошибка сети");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("zenmail_token");
    setIsLoggedIn(false);
    setToken("");
    setHistoryItems([]);
    setFreshEmails([]);
    setSelectedFresh([]);
    setSelectedHistory([]);
    setDomains([]);
    setSelectedDomain("");
    setClientsList([]);
  };

  const fetchDomains = async (authToken = token) => {
    try {
      const res = await fetch("/api/domains", { headers: { "Authorization": `Bearer ${authToken}` } });
      const data = await res.json();
      if (data.success) {
        setDomains(data.domains);
        if (data.domains.length > 0) setSelectedDomain(data.domains[0]);
      }
    } catch (err) {
      console.error("Failed to fetch domains:", err);
    }
  };

  const fetchHistory = async (authToken = token) => {
    try {
      const res = await fetch("/api/history", { headers: { "Authorization": `Bearer ${authToken}` } });
      const data = await res.json();
      if (data.success) {
        setHistoryItems(data.data);
        setSelectedHistory([]);
      } else if (res.status === 401) {
        handleLogout();
        setError("Сессия истекла или неверный токен.");
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  const fetchClients = async (authToken = token) => {
    try {
      const res = await fetch("/api/clients", { headers: { "Authorization": `Bearer ${authToken}` } });
      const data = await res.json();
      if (data.success) setClientsList(data.data);
    } catch (err) {
      console.error("Failed to fetch clients:", err);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (count < 1 || count > 100) return;
    
    setLoading(true);
    setError(null);
    setFreshEmails([]);
    setSelectedFresh([]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ count, domain: selectedDomain }),
      });
      const data = await res.json();

      if (data.success) {
        setFreshEmails(data.generated);
        fetchHistory();
      } else {
        if (res.status === 401) handleLogout();
        setError(data.error || "Произошла ошибка");
      }
    } catch (err) {
      setError("Ошибка сети. Пожалуйста, попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTxt = (emailsToDownload) => {
    if (emailsToDownload.length === 0) return;
    const content = emailsToDownload.map(e => `${e.email}:${e.password}`).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emails-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
      if (res.ok) fetchHistory();
      else if (res.status === 401) handleLogout();
    } catch (err) {
      console.error("Failed to delete email", err);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedHistory.length === 0) return;
    if (!confirm(`Вы уверены, что хотите удалить ${selectedHistory.length} выбранных почт?`)) return;
    
    try {
      await Promise.all(selectedHistory.map(id => 
        fetch(`/api/history?id=${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } })
      ));
      fetchHistory();
    } catch (err) {
      console.error("Failed to delete selected", err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Вы уверены, что хотите удалить ВСЮ историю почт?")) return;
    try {
      const res = await fetch(`/api/history?id=all`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
      if (res.ok) fetchHistory();
    } catch (err) {
      console.error("Failed to clear history", err);
    }
  };

  const toggleSelectFresh = (idx) => {
    setSelectedFresh(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };
  const toggleSelectAllFresh = () => {
    setSelectedFresh(selectedFresh.length === freshEmails.length ? [] : freshEmails.map((_, idx) => idx));
  };
  const toggleSelectHistory = (id) => {
    setSelectedHistory(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const toggleSelectAllHistory = () => {
    setSelectedHistory(selectedHistory.length === historyItems.length ? [] : historyItems.map(item => item.id));
  };

  if (isCheckingAuth) {
    return null; // Return null to prevent any flash of login form
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md shadow-lg border-muted">
          <CardHeader className="space-y-1 items-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">ZenMailFlow</CardTitle>
            <CardDescription>Требуется авторизация для доступа к панели</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Мастер-токен</label>
                <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Введите токен" required />
              </div>
              <Button type="submit" className="w-full">Войти</Button>
            </form>
            {error && <p className="text-destructive text-sm mt-4 text-center">{error}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
    { 
      id: 'adobe-group', 
      label: 'Adobe', 
      icon: Monitor, 
      subItems: [
        { id: 'adobe-list', label: 'Список аккаунтов' },
        { id: 'adobe-upload', label: 'Загрузка аккаунтов' },
        { id: 'audit-logs', label: 'Журнал логов' }
      ] 
    },
    { 
      id: 'email-group', 
      label: 'Email', 
      icon: Mail, 
      subItems: [
        { id: 'generator', label: 'Генерация' },
        { id: 'history', label: 'История', badge: historyItems.length }
      ] 
    },
    { id: 'clients', label: 'Клиенты', icon: Users }
  ];

  const renderNav = () => (
    <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
      <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Навигация
      </div>
      {navItems.map((item) => {
        const Icon = item.icon;
        
        if (item.subItems) {
          return (
            <div key={item.id} className="mb-2">
              <div className="w-full flex items-center px-3 py-2 text-sm font-semibold text-foreground">
                <Icon className="w-4 h-4 mr-3 text-primary" />
                {item.label}
              </div>
              <div className="ml-7 space-y-1 mt-1 border-l pl-2">
                {item.subItems.map(sub => {
                  const isSubActive = activeTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => {
                        changeTab(sub.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        isSubActive 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {sub.label}
                      {sub.badge !== undefined && (
                        <span className={`ml-auto text-xs py-0.5 px-2 rounded-full ${isSubActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                          {sub.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          );
        }

        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              changeTab(item.id);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors mb-1 ${
              isActive 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className={`w-4 h-4 mr-3 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
            {item.label}
            {item.badge !== undefined && (
              <span className={`ml-auto text-xs py-0.5 px-2 rounded-full ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen bg-muted/30 overflow-hidden font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex w-64 bg-background border-r flex-col shrink-0 shadow-sm z-20">
        <div className="h-16 flex items-center px-6 border-b shrink-0">
          <div className="bg-primary/10 p-1.5 rounded-md mr-3">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <span className="font-bold text-lg tracking-tight">ZenMailFlow</span>
        </div>
        {renderNav()}
        
        <div className="p-4 border-t shrink-0">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-3" /> Выйти
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-background border-b shadow-sm shrink-0 z-10">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-md">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold tracking-tight">ZenMailFlow</span>
          </div>
          
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 flex flex-col">
              <div className="h-16 flex items-center px-6 border-b shrink-0">
                <div className="bg-primary/10 p-1.5 rounded-md mr-3">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <span className="font-bold text-lg tracking-tight">ZenMailFlow</span>
              </div>
              {renderNav()}
              <div className="p-4 border-t shrink-0">
                <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-3" /> Выйти
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex flex-col space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">
                {activeTab === 'adobe-list' && 'Список аккаунтов Adobe'}
                {activeTab === 'adobe-upload' && 'Загрузка аккаунтов Adobe'}
                {activeTab === 'audit-logs' && 'Журнал логов'}
                {navItems.find(n => n.id === activeTab)?.label}
              </h1>
              <p className="text-muted-foreground">
                {activeTab === 'dashboard' && 'Статистика и аналитика вашей платформы'}
                {activeTab === 'adobe-list' && 'Управление пулом аккаунтов Adobe и проверка статусов'}
                {activeTab === 'adobe-upload' && 'Массовая загрузка аккаунтов и история загрузок'}
                {activeTab === 'audit-logs' && 'История действий и системных событий'}
                {activeTab === 'clients' && 'Управление клиентской базой и привязками'}
                {activeTab === 'generator' && 'Массовая генерация почтовых ящиков через Migadu'}
                {activeTab === 'history' && 'Управление базой данных сгенерированных почт'}
              </p>
            </div>
            
            <div className="shrink-0 w-full md:w-auto">
              <GlobalSearch 
                token={token} 
                onSelectResult={(type, item) => {
                  if (type === 'client') {
                    setActiveTab('clients');
                  } else if (type === 'account') {
                    setActiveTab('adobe-list');
                  }
                }} 
              />
            </div>
          </div>

          {/* Render Active Tab */}
          {activeTab === 'generator' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Создание корпоративных почт</CardTitle>
                  <CardDescription>Запустите процесс создания новых ящиков</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row items-end gap-4">
                    <div className="space-y-2 flex-1">
                      <label className="text-sm font-medium">Домен</label>
                      <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите домен" />
                        </SelectTrigger>
                        <SelectContent>
                          {domains.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 flex-1 sm:max-w-[200px]">
                      <label className="text-sm font-medium">Количество</label>
                      <Input type="number" min="1" max="100" value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)} required />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                      <Zap className="w-4 h-4 mr-2" />
                      {loading ? "Генерация..." : "Сгенерировать"}
                    </Button>
                  </form>
                  {error && <p className="text-destructive text-sm mt-4">{error}</p>}
                </CardContent>
              </Card>

              {freshEmails.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b mb-4">
                    <div>
                      <CardTitle className="text-lg">Результат генерации ({freshEmails.length})</CardTitle>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => handleDownloadTxt(freshEmails.filter((_, idx) => selectedFresh.includes(idx)))} disabled={selectedFresh.length === 0}>
                        <Download className="w-4 h-4 mr-2" /> Скачать выбранные
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDownloadTxt(freshEmails)}>
                        <Download className="w-4 h-4 mr-2" /> Скачать все
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border shadow-sm">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[50px]">
                              <Checkbox checked={selectedFresh.length === freshEmails.length && freshEmails.length > 0} onCheckedChange={toggleSelectAllFresh} />
                            </TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Password</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {freshEmails.map((item, idx) => (
                            <TableRow key={idx} className={selectedFresh.includes(idx) ? 'bg-muted/30' : ''}>
                              <TableCell>
                                <Checkbox checked={selectedFresh.includes(idx)} onCheckedChange={() => toggleSelectFresh(idx)} />
                              </TableCell>
                              <TableCell className="font-mono text-primary font-medium">{item.email}</TableCell>
                              <TableCell className="font-mono text-sm"><span className="bg-muted px-2 py-1 rounded-md">{item.password}</span></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-4 border-b mb-4">
                <div>
                  <CardTitle className="text-lg">Сохраненные почты</CardTitle>
                  <CardDescription>База данных всех сгенерированных email</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => handleDownloadTxt(historyItems.filter(h => selectedHistory.includes(h.id)))} disabled={selectedHistory.length === 0}>
                    <Download className="w-4 h-4 mr-2" /> Скачать выбранные
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadTxt(historyItems)} disabled={historyItems.length === 0}>
                    <Download className="w-4 h-4 mr-2" /> Скачать все
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={selectedHistory.length === 0}>
                    <Trash2 className="w-4 h-4 mr-2" /> Удалить выбранные
                  </Button>
                  {historyItems.length > 0 && (
                    <Button variant="destructive" size="sm" onClick={handleClearAll} className="bg-red-900 hover:bg-red-800">
                      Удалить все
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {historyItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border rounded-md border-dashed bg-muted/10">
                    <History className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p>Почты еще не сгенерированы.</p>
                  </div>
                ) : (
                  <div className="rounded-md border h-[550px] overflow-auto shadow-sm">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox checked={selectedHistory.length === historyItems.length && historyItems.length > 0} onCheckedChange={toggleSelectAllHistory} />
                          </TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Password</TableHead>
                          <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyItems.map((item) => (
                          <TableRow key={item.id} className={selectedHistory.includes(item.id) ? 'bg-muted/30' : ''}>
                            <TableCell>
                              <Checkbox checked={selectedHistory.includes(item.id)} onCheckedChange={() => toggleSelectHistory(item.id)} />
                            </TableCell>
                            <TableCell className="font-mono text-primary font-medium">{item.email}</TableCell>
                            <TableCell className="font-mono text-sm"><span className="bg-muted px-2 py-1 rounded-md">{item.password}</span></TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0">
                                <Trash2 className="w-4 h-4" />
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
          )}

          {activeTab === 'dashboard' && (
            <DashboardTab token={token} />
          )}

          {activeTab === 'adobe-list' && (
            <AdobeListTab token={token} clients={clientsList} onFetchClients={() => fetchClients(token)} />
          )}

          {activeTab === 'adobe-upload' && (
            <AdobeUploadTab token={token} onFetchClients={() => fetchClients(token)} />
          )}
          
          {activeTab === 'clients' && (
            <ClientsTab token={token} clients={clientsList} onFetchClients={() => fetchClients(token)} />
          )}

          {activeTab === 'audit-logs' && (
            <AuditLogsTab token={token} />
          )}

        </div>
      </main>
      </div>
    </div>
  );
}
