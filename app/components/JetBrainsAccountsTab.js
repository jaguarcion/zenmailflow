'use client';
import { useState, useEffect } from 'react';

export default function JetBrainsAccountsTab({ token }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/jetbrains/accounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data);
      } else {
        setError(data.error || 'Failed to fetch accounts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAccounts();
    }
  }, [token]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Аккаунты JetBrains</h2>
          <p className="text-sm text-slate-400 mt-1">
            Список сгенерированных аккаунтов с лицензией
          </p>
        </div>
        <button
          onClick={fetchAccounts}
          className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors"
        >
          Обновить
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium">Почта (Login)</th>
                <th className="px-6 py-4 font-medium">Пароль</th>
                <th className="px-6 py-4 font-medium">Студ. почта (Origin)</th>
                <th className="px-6 py-4 font-medium">Дата создания</th>
                <th className="px-6 py-4 font-medium">Истекает</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    Загрузка...
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    Аккаунты не найдены
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-3 text-slate-200">
                      <div className="flex items-center gap-2">
                        {acc.email}
                        <button 
                          onClick={() => copyToClipboard(acc.email)}
                          className="text-slate-500 hover:text-white transition-colors"
                          title="Копировать почту"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded">{acc.password}</span>
                        <button 
                          onClick={() => copyToClipboard(acc.password)}
                          className="text-slate-500 hover:text-white transition-colors"
                          title="Копировать пароль"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-400 text-xs">
                      {acc.license_email}
                    </td>
                    <td className="px-6 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(acc.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
                        {new Date(acc.expires_at).toLocaleDateString('ru-RU')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
