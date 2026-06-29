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

  const lineCount = keys.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount || 1 }, (_, i) => i + 1);

  return (
    <Card className="h-full bg-white/70 backdrop-blur-xl border-slate-200 hover:shadow-lg transition-all duration-300">
      <CardContent className="p-4 flex flex-col h-full gap-4">
        <div className="flex justify-between items-end">
          <div className="text-xs font-medium text-slate-500">Список ключей</div>
          <div className="text-[10px] text-slate-400 font-mono">Всего строк: {keys ? keys.split('\n').filter(l => l.trim()).length : 0}</div>
        </div>

        <div className="relative flex-1 flex border border-slate-200 rounded-md overflow-hidden bg-white/50 backdrop-blur-sm shadow-inner">
          <div 
            ref={lineNumbersRef}
            className="w-10 bg-slate-50 text-slate-400 text-right pr-2 py-3 text-xs font-mono select-none overflow-hidden"
            style={{ lineHeight: '1.25rem' }}
          >
            {lineNumbers.map(n => <div key={n}>{n}</div>)}
          </div>
          <textarea 
            ref={textareaRef}
            placeholder="Вставьте ключи здесь...&#10;XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            className="flex-1 w-full p-3 text-xs font-mono resize-none focus:outline-none bg-transparent"
            style={{ lineHeight: '1.25rem', whiteSpace: 'pre' }}
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

        <div className="flex gap-2">
          <Button 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)] hover:shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-all" 
            onClick={startCheck} 
            disabled={running || !keys.trim()}
          >
            <Play className="w-4 h-4 mr-2" />
            Запустить проверку
          </Button>
          <Button 
            variant="destructive" 
            className="px-4"
            onClick={stopCheck} 
            disabled={!running}
          >
            <Square className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
