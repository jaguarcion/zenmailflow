"use client";

import { useState, useEffect } from "react";
import { Search, User, Monitor, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Command,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

export default function GlobalSearch({ token, onSelectResult }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ clients: [], accounts: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ clients: [], accounts: [] });
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setResults(data.data);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounce);
  }, [query, token]);

  const handleSelect = (type, item) => {
    setOpen(false);
    onSelectResult(type, item);
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full md:w-[300px] justify-start text-sm text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        Поиск клиентов или аккаунтов...
        <kbd className="pointer-events-none absolute right-2 top-2.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command shouldFilter={false}>
          <CommandInput 
              placeholder="Введите email, telegram или имя..." 
              value={query}
              onValueChange={setQuery}
          />
          <CommandList>
            {loading && <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
            {!loading && results.clients.length === 0 && results.accounts.length === 0 && (
              <CommandEmpty>Ничего не найдено.</CommandEmpty>
            )}
            
            {!loading && results.clients.length > 0 && (
              <CommandGroup heading="Клиенты">
                {results.clients.map((client) => (
                  <CommandItem key={`client-${client.id}`} onSelect={() => handleSelect('client', client)}>
                    <User className="mr-2 h-4 w-4 text-blue-500" />
                    <div className="flex flex-col">
                      <span className="font-medium">{client.email}</span>
                      <span className="text-xs text-muted-foreground">
                        {[client.telegram_first_name, client.telegram_last_name].filter(Boolean).join(" ")} {client.telegram ? `(@${client.telegram})` : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!loading && results.accounts.length > 0 && (
              <CommandGroup heading="Аккаунты Adobe">
                {results.accounts.map((account) => (
                  <CommandItem key={`acc-${account.id}`} onSelect={() => handleSelect('account', account)}>
                    <Monitor className="mr-2 h-4 w-4 text-purple-500" />
                    <div className="flex flex-col">
                      <span className="font-medium">{account.email}</span>
                      <span className="text-xs text-muted-foreground">
                        Статус: {account.status === 'active' ? 'Активен' : 'Забанен'}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
