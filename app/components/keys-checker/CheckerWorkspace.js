import { useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useChecker } from "./CheckerContext"
import { Play, Square } from "lucide-react"

export function CheckerWorkspace() {
  const { keys, setKeys, running, progress, cooldown, startCheck, stopCheck } = useChecker();
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const lineCount = keys ? keys.split('\n').length : 0;
  const lineNumbers = Array.from({ length: lineCount || 1 }, (_, i) => i + 1);

  return (
    <Card className="flex flex-col bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm transition-all duration-300 rounded-2xl">
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex justify-between items-end">
          <div className="text-sm font-semibold text-slate-500">Список ключей</div>
          <div className="text-[10px] text-slate-400 font-mono">Всего строк: {keys ? keys.split('\n').filter(l => l.trim()).length : 0}</div>
        </div>

        <div className="relative flex border border-slate-200/60 rounded-xl overflow-hidden bg-white shadow-sm h-32">
          <div 
            ref={lineNumbersRef}
            className="w-12 bg-slate-50/50 text-slate-400 text-right pr-3 py-3 text-[13px] font-mono select-none overflow-hidden"
            style={{ lineHeight: '1.5rem' }}
          >
            {lineNumbers.map(n => <div key={n}>{n}</div>)}
          </div>
          <textarea 
            ref={textareaRef}
            placeholder="Вставьте ключи здесь...&#10;XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            className="flex-1 w-full p-3 text-[13px] font-mono resize-none focus:outline-none bg-transparent"
            style={{ lineHeight: '1.5rem', whiteSpace: 'pre' }}
            value={keys}
            onChange={e => setKeys(e.target.value)}
            onScroll={handleScroll}
            disabled={running}
            spellCheck={false}
          />
        </div>
        
        {running && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500 font-mono">
              <span>{progress.current} / {progress.total}</span>
              {cooldown !== null ? (
                <span className="text-orange-600 font-bold animate-pulse">Пауза: {cooldown} сек...</span>
              ) : (
                <span>{pct}%</span>
              )}
            </div>
            <Progress value={pct} className={`h-2 bg-slate-100 ${cooldown !== null ? '[&>div]:bg-orange-500' : '[&>div]:bg-blue-500'}`} />
          </div>
        )}

        <div className="flex gap-3 mt-1">
          <Button 
            className="flex-1 h-12 bg-[#8ba4ff] hover:bg-[#7a95fc] text-white font-medium rounded-xl transition-all" 
            onClick={startCheck} 
            disabled={running || !keys.trim()}
          >
            <Play className="w-5 h-5 mr-2" />
            <span className="text-[15px]">Запустить проверку</span>
          </Button>
          <Button 
            variant="ghost" 
            className="h-12 w-14 px-0 bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-500 rounded-xl transition-all"
            onClick={stopCheck} 
            disabled={!running}
          >
            <Square className="w-5 h-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
