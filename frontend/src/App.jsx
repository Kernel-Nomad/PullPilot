import React, { useState, useEffect, useRef } from 'react';
import { Shield, RefreshCw, Power, AlertTriangle, CheckCircle, XCircle, FileText, X, Loader2, Calendar, Clock, Trash2, Plus, ChevronRight, Languages, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const API_URL = "/api"; 

const MOCK_PROJECTS = [
  { name: "plex-media-server", status: "running", containers: 1, excluded: false, full_stop: false },
  { name: "pihole-dns", status: "running", containers: 2, excluded: false, full_stop: true },
  { name: "vaultwarden", status: "stopped", containers: 0, excluded: true, full_stop: false },
  { name: "home-assistant", status: "running", containers: 3, excluded: false, full_stop: false },
  { name: "nginx-proxy-manager", status: "partial", containers: 1, excluded: false, full_stop: false },
];

const MOCK_HISTORY = [
  { id: 1, status: "SUCCESS", timestamp: new Date().toISOString(), summary: "plex-media-server: OK, pihole-dns: OK", details: "{}" },
  { id: 2, status: "ERROR", timestamp: new Date(Date.now() - 86400000).toISOString(), summary: "vaultwarden: ERROR", details: "{\"error\": \"Connection timed out\"}" },
  { id: 3, status: "SUCCESS", timestamp: new Date(Date.now() - 172800000).toISOString(), summary: "Actualización global completada", details: "{}" },
];

const App = () => {
  const { t, i18n } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [history, setHistory] = useState([]);
  const [schedules, setSchedules] = useState([]); 
  const [updatingProjects, setUpdatingProjects] = useState({}); 
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedLog, setSelectedLog] = useState(null);
  const [isMockMode, setIsMockMode] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [selectedFreq, setSelectedFreq] = useState('daily');

  const [progress, setProgress] = useState({ is_running: false, current: 0, total: 0, current_project: '' });
  const pollingRef = useRef(null);

  useEffect(() => {
    fetchProjects();
    fetchHistory();
    fetchSchedules(); 
    checkProgress();

    return () => stopPolling();
  }, []);

  const handleAuthError = (res) => {
    if (res.status === 401) {
        stopPolling();
        if (window.location.pathname !== '/login') {
          window.location.replace('/login');
        }
        throw new Error('Sesión expirada');
    }
    return res;
  };

  const handleLogout = async () => {
    try {
        await fetch('/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (e) {
        console.error("Error logging out", e);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/projects`).then(handleAuthError);
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      setProjects(data);
      setIsMockMode(false);
    } catch (e) {
      if (e.message !== 'Sesión expirada') {
        console.warn("Backend no detectado. Cargando datos de prueba (Mock Mode).", e);
        setProjects(MOCK_PROJECTS);
        setIsMockMode(true);
      }
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/history`).then(handleAuthError);
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      if (!isMockMode && e.message !== 'Sesión expirada') setHistory(MOCK_HISTORY);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchSchedules = async () => {
    if (isMockMode) return;
    try {
      const res = await fetch(`${API_URL}/schedules`).then(handleAuthError);
      if (res.ok) setSchedules(await res.json());
    } catch (e) { console.error("Error fetching schedules", e); }
  };

  const checkProgress = async () => {
     try {
         const res = await fetch(`${API_URL}/update-status`);
         if(res.status === 401) return;

         if(res.ok) {
             const data = await res.json();
             if (data.is_running) {
                 setProgress(data);
                 if (!pollingRef.current) {
                     startPolling();
                 }
             } else if (pollingRef.current) {
                 stopPolling();
                 setProgress({ is_running: false, current: 0, total: 0, current_project: '' });
                 fetchProjects();
                 fetchHistory();
             }
         }
     } catch(e) { console.error("Error checking progress", e); }
  };

  const startPolling = () => {
      if (pollingRef.current) return;
      pollingRef.current = setInterval(checkProgress, 1000); 
  };

  const stopPolling = () => {
      if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
      }
  };

  const handleUpdateProject = async (name) => {
    setUpdatingProjects(prev => ({ ...prev, [name]: true }));
    
    if (isMockMode) {
      await new Promise(resolve => setTimeout(resolve, 1500)); 
    } else {
      try {
        await fetch(`${API_URL}/projects/${name}/update`, { method: 'POST' }).then(handleAuthError);
        await fetchProjects();
      } catch (e) { if(e.message !== 'Sesión expirada') alert(t('alerts.backend_error')); }
    }
    
    setUpdatingProjects(prev => {
        const newState = { ...prev };
        delete newState[name];
        return newState;
    });
  };

  const handleUpdateAll = async () => {
    if (!confirm(t('alerts.update_all_confirm'))) return;
    
    if (isMockMode) {
        alert(t('alerts.mock_global'));
    } else {
        try {
            await fetch(`${API_URL}/update-all`, { method: 'POST' }).then(handleAuthError);
            setProgress({ is_running: true, current: 0, total: 1, current_project: 'Iniciando...' });
            startPolling();
        } catch (e) { if(e.message !== 'Sesión expirada') alert(t('alerts.backend_error')); }
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        target: formData.get('target'),
        task_type: 'cron',
        frequency: formData.get('frequency'),
        week_day: formData.get('week_day') || '*',
        day_of_month: formData.get('day_of_month') || '1',
        hour: parseInt(formData.get('hour')),
        minute: parseInt(formData.get('minute')),
    };

    try {
        await fetch(`${API_URL}/schedules`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        }).then(handleAuthError);
        fetchSchedules();
        e.target.reset();
        setSelectedFreq('daily');
    } catch(err) { if(err.message !== 'Sesión expirada') alert(t('alerts.schedule_error')); }
  };

  const handleDeleteSchedule = async (id) => {
      if(!confirm(t('alerts.delete_schedule_confirm'))) return;
      try {
        await fetch(`${API_URL}/schedules/${id}`, { method: 'DELETE' }).then(handleAuthError);
        fetchSchedules();
      } catch(e) {}
  };

  const toggleSetting = async (name, setting) => {
    setProjects(prev => prev.map(p => {
      if (p.name === name) {
        if (setting === 'exclude') return { ...p, excluded: !p.excluded };
        if (setting === 'fullstop') return { ...p, full_stop: !p.full_stop };
      }
      return p;
    }));

    if (!isMockMode) {
      try {
        await fetch(`${API_URL}/projects/${name}/toggle_${setting}`, { method: 'POST' }).then(handleAuthError);
        fetchProjects(); 
      } catch (e) { 
        if(e.message !== 'Sesión expirada') console.error(t('alerts.config_error'));
      }
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  const formatExpression = (expr) => {
      if (!expr) return "";
      const parts = expr.split(' ');
      const min = parts[0].padStart(2, '0');
      const hour = parts[1];
      const day = parts[2];
      const week = parts[4];

      if (day === '*' && week === '*') return t('schedule.format.daily', { time: `${hour}:${min}` });
      
      if (week !== '*') {
          const translatedDay = t(`days.${week}`) !== `days.${week}` ? t(`days.${week}`) : week;
          return t('schedule.format.weekly', { day: translatedDay, time: `${hour}:${min}` });
      }
      
      if (day !== '*') return t('schedule.format.monthly', { day: day, time: `${hour}:${min}` });
      
      return expr;
  };

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 md:px-6 md:py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="PullPilot Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain" />
          
          <div className="hidden md:block">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">{t('app.title')}</h1>
            <p className="text-xs text-slate-500 font-medium">{t('app.subtitle')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
            {isMockMode && (
                <span className="hidden lg:inline-flex items-center gap-1 text-xs font-mono bg-yellow-100 text-yellow-800 px-2 py-1 rounded border border-yellow-200">
                    <AlertTriangle size={12} /> {t('app.demo_mode')}
                </span>
            )}
            
            <button 
              onClick={toggleLanguage} 
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
              title="Change Language"
            >
              <Languages size={20} />
              <span className="text-xs font-bold">{i18n.language.toUpperCase()}</span>
            </button>

            <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                title={t('auth.logout') || "Logout"}
            >
                <LogOut size={20} />
            </button>

            <nav className="hidden sm:flex gap-1 bg-slate-100 p-1 rounded-lg">
            {['dashboard', 'schedule', 'history'].map(tab => (
                <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-md text-xs md:text-sm font-medium transition-all ${
                    activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                >
                {t(`nav.${tab}`)}
                </button>
            ))}
            </nav>
        </div>
      </header>
      
      <div className="sm:hidden px-4 py-2 bg-white border-b border-slate-200 sticky top-[60px] z-10">
         <nav className="flex gap-1 bg-slate-100 p-1 rounded-lg justify-between">
            {['dashboard', 'schedule', 'history'].map(tab => (
                <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                >
                {t(`nav.${tab}`)}
                </button>
            ))}
         </nav>
      </div>

      {progress.is_running && (
        <div className="bg-blue-600 text-white px-6 py-3 shadow-md transition-all duration-300">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Loader2 className="animate-spin" size={20} />
                    <div className="flex flex-col">
                        <span className="font-bold text-sm">{t('status.updating_homelab')}</span>
                        <span className="text-xs text-blue-200">
                            {t('status.processing')}: <span className="font-mono font-bold text-white">{progress.current_project}</span>
                        </span>
                    </div>
                </div>
                
                <div className="w-full md:w-1/2 flex items-center gap-3">
                    <div className="w-full bg-blue-800/50 rounded-full h-2.5 overflow-hidden">
                        <div 
                            className="bg-white h-2.5 rounded-full transition-all duration-500 ease-out" 
                            style={{ width: `${percent}%` }}
                        ></div>
                    </div>
                    <span className="text-xs font-bold min-w-[3rem]">{percent}%</span>
                    <span className="text-xs text-blue-200 whitespace-nowrap">
                        ({progress.current}/{progress.total})
                    </span>
                </div>
            </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4 md:p-6 w-full flex-grow">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-blue-50 p-6 rounded-xl border border-blue-100 gap-4">
              <div>
                <h2 className="text-lg font-semibold text-blue-900">{t('status.system_status')}</h2>
                <p className="text-blue-700 text-sm mt-1">
                  {t('status.projects_detected', { count: projects.length })} {t('status.active', { count: projects.filter(p => p.status === 'running').length })}
                </p>
              </div>
              <button 
                onClick={handleUpdateAll}
                disabled={progress.is_running}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-md transition-all active:scale-95 font-medium disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {progress.is_running ? (
                    <Loader2 size={20} className="animate-spin" /> 
                ) : (
                    <RefreshCw size={20} />
                )}
                {progress.is_running ? t('status.updating_btn') : t('status.update_all')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => {
                const isUpdatingThis = updatingProjects[project.name];
                const isGlobalUpdate = progress.is_running;
                const isLocked = isGlobalUpdate || isUpdatingThis;

                return (
                  <div 
                    key={project.name} 
                    className={`bg-white rounded-xl border shadow-sm transition-all duration-200 
                      ${project.excluded ? 'opacity-60 border-slate-200 bg-slate-50' : 'border-slate-200'}
                      ${isLocked ? 'opacity-60 pointer-events-none select-none grayscale-[0.5]' : 'hover:shadow-md'}
                    `}
                  >
                    <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800 break-all">{project.name}</h3>
                        {(isGlobalUpdate && progress.current_project === project.name) || isUpdatingThis ? (
                           <span className="text-xs text-blue-600 flex items-center gap-1 mt-1 animate-pulse font-bold">
                               <Loader2 size={12} className="animate-spin" /> {t('status.updating')}
                           </span>
                        ) : (
                          <div className="flex items-center gap-2 mt-1">
                              <span className={`w-2 h-2 rounded-full ${project.status === 'running' ? 'bg-green-500' : project.status === 'partial' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">{project.status}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                         <button 
                          onClick={() => handleUpdateProject(project.name)}
                          disabled={updatingProjects[project.name] || project.excluded || progress.is_running}
                          title={t('status.update_all')}
                          className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg disabled:opacity-50 transition-colors"
                        >
                          <RefreshCw size={18} className={updatingProjects[project.name] ? 'animate-spin' : ''} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-5 space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 flex items-center gap-2">
                          <FileText size={16} /> {t('card.containers')}
                        </span>
                        <span className="font-mono font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-700">{project.containers}</span>
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                         <label className="flex items-center justify-between cursor-pointer group">
                          <span className="text-sm text-slate-600 group-hover:text-slate-900 flex items-center gap-2">
                            <Power size={16} /> {t('card.full_stop')}
                          </span>
                          <div className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={project.full_stop} 
                                onChange={() => toggleSetting(project.name, 'fullstop')} 
                                disabled={isLocked}
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                          </div>
                        </label>
                        
                        <label className="flex items-center justify-between cursor-pointer group">
                           <span className="text-sm text-slate-600 group-hover:text-slate-900 flex items-center gap-2">
                            <AlertTriangle size={16} /> {t('card.exclude')}
                          </span>
                          <div className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={project.excluded} 
                                onChange={() => toggleSetting(project.name, 'exclude')} 
                                disabled={isLocked}
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 pb-4 border-b border-slate-100">
                    <Clock size={20} className="text-blue-600"/> {t('schedule.new_schedule')}
                </h2>
                <form onSubmit={handleCreateSchedule} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('schedule.target')}</label>
                        <div className="relative">
                            <select 
                              name="target" 
                              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-700"
                            >
                                <option value="GLOBAL">{t('schedule.target_global')}</option>
                                {projects.map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronRight className="absolute right-3 top-3 text-slate-400 rotate-90 pointer-events-none" size={16} />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('schedule.frequency')}</label>
                        <div className="relative">
                            <select 
                                name="frequency" 
                                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-700"
                                onChange={(e) => setSelectedFreq(e.target.value)}
                                value={selectedFreq}
                            >
                                <option value="daily">{t('schedule.freq_daily')}</option>
                                <option value="weekly">{t('schedule.freq_weekly')}</option>
                                <option value="monthly">{t('schedule.freq_monthly')}</option>
                            </select>
                            <ChevronRight className="absolute right-3 top-3 text-slate-400 rotate-90 pointer-events-none" size={16} />
                        </div>
                    </div>

                    {selectedFreq === 'weekly' && (
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('schedule.day_week')}</label>
                            <div className="relative">
                                <select name="week_day" className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-700">
                                    {['mon','tue','wed','thu','fri','sat','sun'].map(d => <option key={d} value={d}>{t(`days.${d}`)}</option>)}
                                </select>
                                <ChevronRight className="absolute right-3 top-3 text-slate-400 rotate-90 pointer-events-none" size={16} />
                            </div>
                        </div>
                    )}
                    
                    {selectedFreq === 'monthly' && (
                        <div className="flex flex-col gap-2">
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('schedule.day_month')}</label>
                             <div className="relative">
                                <select name="day_of_month" className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-700">
                                    {[...Array(28)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                                </select>
                                <ChevronRight className="absolute right-3 top-3 text-slate-400 rotate-90 pointer-events-none" size={16} />
                            </div>
                        </div>
                    )}

                    {selectedFreq === 'daily' && <div className="hidden lg:block"></div>}

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('schedule.time')}</label>
                        <div className="flex gap-2 items-center bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <input type="number" name="hour" min="0" max="23" placeholder="04" defaultValue="04" required 
                                className="bg-transparent w-full text-center text-sm font-medium focus:outline-none text-slate-700 placeholder-slate-300" />
                            <span className="font-bold text-slate-300">:</span>
                            <input type="number" name="minute" min="0" max="59" placeholder="00" defaultValue="00" required 
                                className="bg-transparent w-full text-center text-sm font-medium focus:outline-none text-slate-700 placeholder-slate-300" />
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white p-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md h-[46px]">
                        <Plus size={18} /> {t('schedule.create_btn')}
                    </button>
                </form>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                 <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">{t('schedule.active_tasks')}</h3>
                    <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">
                        {t('schedule.tasks_count', { count: schedules.length })}
                    </span>
                </div>
                {schedules.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Calendar size={48} className="text-slate-200" />
                        <p className="italic">{t('schedule.no_tasks')}</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-slate-100">
                            {schedules.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50 group transition-colors">
                                    <td className="p-4 font-bold text-slate-800">
                                        {s.target === 'GLOBAL' ? 
                                            <span className="text-blue-600 flex items-center gap-2"><Shield size={16}/> {t('schedule.target_global')}</span> : 
                                            s.target}
                                    </td>
                                    <td className="p-4 font-mono text-slate-600 text-xs md:text-sm">
                                        {formatExpression(s.expression)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => handleDeleteSchedule(s.id)}
                                            className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
               <h2 className="text-lg font-bold text-slate-800">{t('history.title')}</h2>
               <button 
                 onClick={fetchHistory} 
                 disabled={historyLoading}
                 className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
               >
                 <RefreshCw size={18} className={historyLoading ? 'animate-spin' : ''} />
               </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-xs">
                  <tr>
                    <th className="px-6 py-4">{t('history.table_status')}</th>
                    <th className="px-6 py-4">{t('history.table_date')}</th>
                    <th className="px-6 py-4">{t('history.table_summary')}</th>
                    <th className="px-6 py-4">{t('history.table_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        {log.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                            <CheckCircle size={14} /> {t('history.status_success')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                            <XCircle size={14} /> {t('history.status_error')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 max-w-md truncate" title={log.summary}>
                        {log.summary}
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => setSelectedLog(log)}
                          className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                        >
                          {t('history.view_details')}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-slate-400 italic">
                        {t('history.no_logs')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedLog && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">{t('modal.title', { id: selectedLog.id })}</h3>
                <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto font-mono text-xs bg-slate-900 text-slate-300">
                <pre className="whitespace-pre-wrap">{JSON.stringify(JSON.parse(selectedLog.details), null, 2)}</pre>
              </div>
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  {t('modal.close')}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-6 md:py-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-slate-400 text-sm font-medium text-center md:text-left order-2 md:order-1">
                <p>&copy; {new Date().getFullYear()} <span className="text-slate-600 font-semibold">KN</span></p>
            </div>
            <div className="flex flex-row flex-wrap justify-center items-center gap-4 md:gap-6 order-1 md:order-2">
                <a href="https://ko-fi.com/F2F81PNZRL" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1 rounded-full text-white text-sm font-bold transition-all hover:opacity-90 hover:scale-105 active:scale-95 shadow-sm h-[28px] whitespace-nowrap"
                  style={{ backgroundColor: '#7700ff' }}
                >
                   <span style={{ fontFamily: 'inherit' }}>{t('footer.tip_me')}</span>
                </a>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
