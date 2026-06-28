import { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { RefreshCw, Inbox } from "lucide-react"
import { useChecker } from "./CheckerContext"

// Simple Counter component instead of AnimatedCounter to simplify
const Counter = ({ value }) => <span>{value}</span>;

export function ResultsTable() {
  const { results, stats, running, recheckKey } = useChecker();
  const [filter, setFilter] = useState('all');

  const resultsWithIndex = results.map((r, i) => ({ ...r, originalIndex: i }));
  const filteredResults = resultsWithIndex.filter(r => filter === 'all' || r.status === filter);

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <Card 
          className={`bg-emerald-50/80 border-emerald-100 backdrop-blur-md shadow-none hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all cursor-pointer ${filter === 'good' ? 'ring-2 ring-emerald-500 shadow-md' : ''}`}
          onClick={() => setFilter(filter === 'good' ? 'all' : 'good')}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600"><Counter value={stats.good} /></div>
            <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Валидные</div>
          </CardContent>
        </Card>
        <Card 
          className={`bg-rose-50/80 border-rose-100 backdrop-blur-md shadow-none hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(244,63,94,0.15)] transition-all cursor-pointer ${filter === 'bad' ? 'ring-2 ring-rose-500 shadow-md' : ''}`}
          onClick={() => setFilter(filter === 'bad' ? 'all' : 'bad')}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-rose-600"><Counter value={stats.bad} /></div>
            <div className="text-[10px] uppercase font-bold text-rose-500 tracking-wider">Невалидные</div>
          </CardContent>
        </Card>
        <Card 
          className={`bg-amber-50/80 border-amber-100 backdrop-blur-md shadow-none hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] transition-all cursor-pointer ${filter === 'other' ? 'ring-2 ring-amber-500 shadow-md' : ''}`}
          onClick={() => setFilter(filter === 'other' ? 'all' : 'other')}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600"><Counter value={stats.other} /></div>
            <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Ошибки</div>
          </CardContent>
        </Card>
        <Card 
          className={`bg-slate-50/80 border-slate-200 backdrop-blur-md shadow-none hover:-translate-y-1 hover:shadow-lg transition-all cursor-pointer ${filter === 'all' ? 'ring-2 ring-slate-400 shadow-md' : ''}`}
          onClick={() => setFilter('all')}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-700"><Counter value={stats.total} /></div>
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Всего</div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 min-h-[300px] overflow-hidden flex flex-col bg-white/70 backdrop-blur-xl border-slate-200">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 sticky top-0 backdrop-blur-md">
              <TableRow>
                <TableHead className="w-[40px] text-center">#</TableHead>
                <TableHead>Ключ</TableHead>
                <TableHead className="w-[120px]">Статус</TableHead>
                <TableHead>Ответ</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center whitespace-normal">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-60 hover:opacity-100 transition-opacity">
                      <div className="p-4 bg-slate-100 rounded-full">
                        <Inbox className="w-8 h-8 text-slate-500" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-600">Нет данных для отображения</div>
                        <div className="text-xs mt-2 max-w-sm mx-auto leading-relaxed whitespace-normal text-balance">
                          {results.length === 0 
                            ? "Вставьте список ключей в панель слева и нажмите Запустить проверку, чтобы увидеть результаты."
                            : "По выбранному фильтру ничего не найдено."}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filteredResults.map((r) => (
                <TableRow key={r.originalIndex} className="text-xs font-mono">
                  <TableCell className="text-center text-slate-400">{r.originalIndex + 1}</TableCell>
                  <TableCell className="font-semibold text-slate-700">{r.key}</TableCell>
                  <TableCell>
                    {r.status === 'good' && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">{r.statusText}</Badge>}
                    {r.status === 'bad' && <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">{r.statusText}</Badge>}
                    {r.status === 'other' && <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-200">{r.statusText}</Badge>}
                  </TableCell>
                  <TableCell className="text-[10px] text-slate-500 max-w-[200px] truncate" title={r.response}>
                    {r.response}
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-slate-400 hover:text-blue-500"
                      onClick={() => recheckKey(r.originalIndex)}
                      title="Проверить еще раз"
                      disabled={running}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
