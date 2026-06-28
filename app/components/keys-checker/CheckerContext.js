import React, { createContext, useContext, useState, useRef } from 'react';
import { toast } from 'sonner';

const CheckerContext = createContext(null);

export const CheckerProvider = ({ children, token }) => {
  const [keys, setKeys] = useState('');
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [cooldown, setCooldown] = useState(null);
  const stopFlag = useRef(false);

  const stats = {
    good: results.filter(r => r.status === 'good').length,
    bad: results.filter(r => r.status === 'bad').length,
    other: results.filter(r => r.status === 'other').length,
    total: results.length
  };

  const classify = (adobeStatus, httpCode, _body) => {
    if (httpCode === 200) return 'good';
    if (httpCode === 400) {
      if (adobeStatus === 'REGION_MISMATCH_ERROR') return 'good';
      return 'bad';
    }
    if (httpCode === 403 || httpCode === 429) return 'other';
    return 'other';
  };

  const startCheck = async () => {
    const lines = keys.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (!lines.length) return toast.error('Введите ключи');

    setRunning(true);
    stopFlag.current = false;
    setCooldown(null);
    setResults([]);
    setProgress({ current: 0, total: lines.length });

    const newResults = [];
    let checkedSincePause = 0;

    for (let i = 0; i < lines.length; i++) {
      if (stopFlag.current) break;
      const key = lines[i];

      // Proactively pause every 8 keys to avoid 429 token bans
      if (checkedSincePause >= 8) {
          newResults.push({ key, status: 'other', statusText: 'Ожидание', response: 'Ожидание антифрода 60 сек...' });
          setResults([...newResults]);
          for (let w = 60; w > 0; w--) {
              if (stopFlag.current) break;
              setCooldown(w);
              newResults[newResults.length - 1] = { key, status: 'other', statusText: 'Ожидание', response: `Пауза антифрода: ${w} сек...` };
              setResults([...newResults]);
              await new Promise(r => setTimeout(r, 1000));
          }
          setCooldown(null);
          newResults.pop();
          setResults([...newResults]);
          checkedSincePause = 0;
          if (stopFlag.current) break;
      }

      try {
        const res = await fetch('/api/checker/check', {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ code: key })
        });
        const data = await res.json();
        
        if (data.http_code === 429) {
            newResults.push({ key, status: 'other', statusText: 'Ожидание...', response: 'HTTP 429 Too Many Requests' });
            setResults([...newResults]);
            
            for (let w = 60; w > 0; w--) {
                if (stopFlag.current) break;
                setCooldown(w);
                newResults[newResults.length - 1] = { key, status: 'other', statusText: 'Блок (429)', response: `Ожидание разблокировки токена: ${w} сек...` };
                setResults([...newResults]);
                await new Promise(r => setTimeout(r, 1000));
            }
            
            setCooldown(null);
            newResults.pop();
            setResults([...newResults]);
            
            checkedSincePause = 0;
            if (stopFlag.current) break;
            
            i--; // Retry same key
            continue;
        }

        checkedSincePause++;

        const bodyStr = typeof data.body === 'object' ? JSON.stringify(data.body) : String(data.body);
        const rawResponse = data.adobe_status || (data.body && data.body.message) || bodyStr;
        let statusText = 'Ошибка';

        if (data.adobe_status === 'REGION_MISMATCH_ERROR') {
            statusText = 'Валидный (Другой регион)';
        } else if (data.adobe_status === 'RCODE_ALREADY_REDEEMED') {
            statusText = 'Уже активирован';
        } else if (data?.body?.message === 'Invalid rcode' || data.adobe_status === 'INVALID_RCODE_ERROR') {
            statusText = 'Невалидный - Недействительный код';
        } else {
            statusText = 'Ошибка проверки';
        }
        
        const status = classify(data.adobe_status, data.http_code, data.body);
        const resultItem = { key, status, statusText, response: rawResponse };
        
        newResults.push(resultItem);
        setResults([...newResults]);

      } catch (e) {
        newResults.push({ key, status: 'other', statusText: 'Ошибка', response: 'Сетевая ошибка' });
        setResults([...newResults]);
      }
      setProgress({ current: i + 1, total: lines.length });
    }
    
    setRunning(false);
    toast.success('Проверка завершена!');
  };

  const stopCheck = () => {
    stopFlag.current = true;
    setCooldown(null);
    setRunning(false);
  };

  const recheckKey = async (index) => {
    if (index < 0 || index >= results.length) return;
    
    const newResults = [...results];
    const key = newResults[index].key;
    newResults[index] = { ...newResults[index], status: 'other', statusText: 'Проверка...', response: 'Повторная проверка...' };
    setResults(newResults);
    
    try {
      const res = await fetch('/api/checker/check', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: key })
      });
      const data = await res.json();
      
      if (data.http_code === 429) {
          toast.error('Токен заблокирован. Подождите 1-2 минуты.');
          newResults[index] = { key, status: 'other', statusText: 'Блок (429)', response: 'Токен заблокирован (429)' };
          setResults([...newResults]);
          return;
      }
      
      const bodyStr = typeof data.body === 'object' ? JSON.stringify(data.body) : String(data.body);
      const rawResponse = data.adobe_status || (data.body && data.body.message) || bodyStr;
      let statusText = 'Ошибка';

      if (data.adobe_status === 'REGION_MISMATCH_ERROR') {
          statusText = 'Валидный (Другой регион)';
      } else if (data.adobe_status === 'RCODE_ALREADY_REDEEMED') {
          statusText = 'Уже активирован';
      } else if (data?.body?.message === 'Invalid rcode' || data.adobe_status === 'INVALID_RCODE_ERROR') {
          statusText = 'Невалидный - Недействительный код';
      } else {
          statusText = 'Ошибка проверки';
      }
      
      const status = classify(data.adobe_status, data.http_code, data.body);
      newResults[index] = { key, status, statusText, response: rawResponse };
      setResults([...newResults]);

    } catch (e) {
      newResults[index] = { key, status: 'other', statusText: 'Ошибка', response: 'Сетевая ошибка' };
      setResults([...newResults]);
    }
  };

  return (
    <CheckerContext.Provider value={{ token, keys, setKeys, results, setResults, running, progress, startCheck, stopCheck, recheckKey, stats, cooldown }}>
      {children}
    </CheckerContext.Provider>
  );
};

export const useChecker = () => {
  const ctx = useContext(CheckerContext);
  if (!ctx) throw new Error('useChecker must be used within CheckerProvider');
  return ctx;
};
