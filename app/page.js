"use client";

import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [token, setToken] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [activeTab, setActiveTab] = useState("generator"); // 'generator' or 'history'
  
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [freshEmails, setFreshEmails] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Selection states
  const [selectedFresh, setSelectedFresh] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState([]);

  useEffect(() => {
    const savedToken = localStorage.getItem("zenmail_token");
    if (savedToken) {
      setToken(savedToken);
      setIsLoggedIn(true);
      fetchDomains(savedToken);
      fetchHistory(savedToken);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (token.trim()) {
      localStorage.setItem("zenmail_token", token);
      setIsLoggedIn(true);
      fetchDomains(token);
      fetchHistory(token);
      setError(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("zenmail_token");
    setIsLoggedIn(false);
    setToken("");
    setHistory([]);
    setFreshEmails([]);
    setSelectedFresh([]);
    setSelectedHistory([]);
    setDomains([]);
    setSelectedDomain("");
  };

  const fetchDomains = async (authToken = token) => {
    try {
      const res = await fetch("/api/domains", {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setDomains(data.domains);
        if (data.domains.length > 0) {
          setSelectedDomain(data.domains[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch domains:", err);
    }
  };

  const fetchHistory = async (authToken = token) => {
    try {
      const res = await fetch("/api/history", {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setHistory(data.data);
        setSelectedHistory([]); // reset selection on refresh
      } else if (res.status === 401) {
        handleLogout();
        setError("Сессия истекла или неверный токен.");
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
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
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ count, domain: selectedDomain }),
      });
      const data = await res.json();

      if (data.success) {
        setFreshEmails(data.generated);
        fetchHistory(); // refresh history
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
    a.download = `migadu-emails-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/history?id=${id}`, { 
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        fetchHistory();
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error("Failed to delete email", err);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedHistory.length === 0) return;
    if (!confirm(`Вы уверены, что хотите удалить ${selectedHistory.length} выбранных почт?`)) return;
    
    // Process sequentially to keep it simple, or use Promise.all
    try {
      await Promise.all(selectedHistory.map(id => 
        fetch(`/api/history?id=${id}`, { 
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        })
      ));
      fetchHistory();
    } catch (err) {
      console.error("Failed to delete selected", err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Вы уверены, что хотите удалить ВСЮ историю почт?")) return;
    try {
      const res = await fetch(`/api/history?id=all`, { 
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        fetchHistory();
      }
    } catch (err) {
      console.error("Failed to clear history", err);
    }
  };

  // Selection helpers
  const toggleSelectFresh = (idx) => {
    if (selectedFresh.includes(idx)) {
      setSelectedFresh(selectedFresh.filter(i => i !== idx));
    } else {
      setSelectedFresh([...selectedFresh, idx]);
    }
  };

  const toggleSelectAllFresh = () => {
    if (selectedFresh.length === freshEmails.length) {
      setSelectedFresh([]);
    } else {
      setSelectedFresh(freshEmails.map((_, idx) => idx));
    }
  };

  const toggleSelectHistory = (id) => {
    if (selectedHistory.includes(id)) {
      setSelectedHistory(selectedHistory.filter(i => i !== id));
    } else {
      setSelectedHistory([...selectedHistory, id]);
    }
  };

  const toggleSelectAllHistory = () => {
    if (selectedHistory.length === history.length) {
      setSelectedHistory([]);
    } else {
      setSelectedHistory(history.map(item => item.id));
    }
  };

  if (!isLoggedIn) {
    return (
      <main className="container login-container">
        <h1>ZenMailFlow</h1>
        <p className="subtitle">Требуется авторизация</p>
        <div className="glass-panel">
          <form onSubmit={handleLogin} className="form-group">
            <label htmlFor="token">Мастер-токен</label>
            <input
              type="password"
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Введите ваш токен доступа"
              required
            />
            <button type="submit" className="btn" style={{ marginTop: '1rem' }}>Войти</button>
          </form>
          {error && <p style={{ color: 'var(--danger-color)', marginTop: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>ZenMailFlow</h1>
        <button onClick={handleLogout} className="btn btn-secondary btn-sm">Выйти</button>
      </div>
      
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'generator' ? 'active' : ''}`}
          onClick={() => setActiveTab('generator')}
        >
          Генерация
        </button>
        <button 
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          История ({history.length})
        </button>
      </div>

      {activeTab === 'generator' && (
        <>
          <div className="glass-panel" style={{ padding: '1rem 1.5rem' }}>
            <form onSubmit={handleGenerate} className="flex-row" style={{ alignItems: 'flex-end', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0, flex: 2 }} ref={dropdownRef}>
                <label>Домен</label>
                <div className="custom-select-container">
                  <div 
                    className={`custom-select-header ${isDropdownOpen ? 'open' : ''}`}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    {selectedDomain || "Выберите домен"}
                    <span className="arrow"></span>
                  </div>
                  {isDropdownOpen && (
                    <ul className="custom-select-list">
                      {domains.map(d => (
                        <li 
                          key={d} 
                          className={`custom-select-item ${d === selectedDomain ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedDomain(d);
                            setIsDropdownOpen(false);
                          }}
                        >
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <label htmlFor="count">Количество (1-100)</label>
                <input
                  type="number"
                  id="count"
                  min="1"
                  max="100"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
              <button type="submit" className="btn" disabled={loading} style={{ marginTop: '1.2rem' }}>
                {loading ? (
                  <>
                    <span className="loader"></span>
                    Генерация...
                  </>
                ) : (
                  "Сгенерировать"
                )}
              </button>
            </form>
            {error && <p style={{ color: 'var(--danger-color)', marginTop: '1rem', fontSize: '0.9rem' }}>{error}</p>}
          </div>

          {freshEmails.length > 0 && (
            <div className="glass-panel">
              <div className="section-header">
                <h3>Сгенерированные почты ({freshEmails.length})</h3>
                <div className="flex-row">
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => handleDownloadTxt(freshEmails.filter((_, idx) => selectedFresh.includes(idx)))}
                    disabled={selectedFresh.length === 0}
                  >
                    Скачать выбранные
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => handleDownloadTxt(freshEmails)}
                  >
                    Скачать все
                  </button>
                </div>
              </div>
              
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="checkbox-cell">
                        <input 
                          type="checkbox" 
                          checked={selectedFresh.length === freshEmails.length && freshEmails.length > 0}
                          onChange={toggleSelectAllFresh}
                        />
                      </th>
                      <th>Адрес почты</th>
                      <th>Пароль</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freshEmails.map((item, idx) => (
                      <tr key={idx} className={selectedFresh.includes(idx) ? 'selected' : ''}>
                        <td className="checkbox-cell">
                          <input 
                            type="checkbox" 
                            checked={selectedFresh.includes(idx)}
                            onChange={() => toggleSelectFresh(idx)}
                          />
                        </td>
                        <td><span className="email-address">{item.email}</span></td>
                        <td><span className="email-password">{item.password}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="glass-panel">
          <div className="section-header">
            <h3>Сохраненные почты</h3>
            <div className="flex-row">
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => handleDownloadTxt(history.filter(h => selectedHistory.includes(h.id)))}
                disabled={selectedHistory.length === 0}
              >
                Скачать выбранные
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => handleDownloadTxt(history)}
                disabled={history.length === 0}
              >
                Скачать все
              </button>
              <button 
                className="btn btn-danger btn-sm" 
                onClick={handleDeleteSelected}
                disabled={selectedHistory.length === 0}
              >
                Удалить выбранные
              </button>
              {history.length > 0 && (
                <button className="btn btn-danger btn-sm" onClick={handleClearAll}>
                  Удалить все
                </button>
              )}
            </div>
          </div>
          
          {history.length === 0 ? (
            <div className="empty-state">Почты еще не сгенерированы.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="checkbox-cell">
                      <input 
                        type="checkbox" 
                        checked={selectedHistory.length === history.length && history.length > 0}
                        onChange={toggleSelectAllHistory}
                      />
                    </th>
                    <th>Адрес почты</th>
                    <th>Пароль</th>
                    <th className="actions-cell">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className={selectedHistory.includes(item.id) ? 'selected' : ''}>
                      <td className="checkbox-cell">
                        <input 
                          type="checkbox" 
                          checked={selectedHistory.includes(item.id)}
                          onChange={() => toggleSelectHistory(item.id)}
                        />
                      </td>
                      <td><span className="email-address">{item.email}</span></td>
                      <td><span className="email-password">{item.password}</span></td>
                      <td className="actions-cell">
                        <button 
                          className="btn btn-danger btn-sm" 
                          onClick={() => handleDelete(item.id)}
                          title="Удалить"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
