import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import Dashboard from "./components/Dashboard";
import Footer from "./components/Footer";
import Header from "./components/Header";
import HistoryView from "./components/HistoryView";
import LogModal from "./components/LogModal";
import ProgressBar from "./components/ProgressBar";
import ScheduleView from "./components/ScheduleView";
import { usePolling } from "./hooks/usePolling";
import {
  createSchedule,
  deleteSchedule,
  fetchHistory,
  fetchProjects,
  fetchSchedules,
  fetchUpdateStatus,
  logout,
  SESSION_EXPIRED_ERROR,
  toggleProjectSetting,
  triggerUpdateAll,
  updateProject,
} from "./lib/api";
import { MOCK_HISTORY, MOCK_PROJECTS } from "./lib/mockData";

const DEFAULT_PROGRESS = {
  is_running: false,
  current: 0,
  total: 0,
  current_project: "",
};

export default function App() {
  const { t, i18n } = useTranslation();

  const [projects, setProjects] = useState([]);
  const [history, setHistory] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [updatingProjects, setUpdatingProjects] = useState({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedLog, setSelectedLog] = useState(null);
  const [isMockMode, setIsMockMode] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedFreq, setSelectedFreq] = useState("daily");
  const [progress, setProgress] = useState(DEFAULT_PROGRESS);

  const { startPolling, stopPolling } = usePolling();

  const handleUnauthorized = useCallback(() => {
    stopPolling();
    if (window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  }, [stopPolling]);

  const requestContext = useMemo(
    () => ({
      onUnauthorized: handleUnauthorized,
    }),
    [handleUnauthorized]
  );

  const loadProjects = useCallback(async () => {
    try {
      const data = await fetchProjects(requestContext);
      setProjects(data);
      setIsMockMode(false);
    } catch (error) {
      if (error.message !== SESSION_EXPIRED_ERROR) {
        console.warn("Backend no detectado. Cargando datos de prueba (mock mode).", error);
        setProjects(MOCK_PROJECTS);
        setIsMockMode(true);
      }
    }
  }, [requestContext]);

  const loadHistory = useCallback(
    async (allowMockFallback = true) => {
      setHistoryLoading(true);
      try {
        const data = await fetchHistory(requestContext);
        setHistory(data);
      } catch (error) {
        if (allowMockFallback && error.message !== SESSION_EXPIRED_ERROR) {
          setHistory(MOCK_HISTORY);
        }
      } finally {
        setHistoryLoading(false);
      }
    },
    [requestContext]
  );

  const loadSchedules = useCallback(async () => {
    if (isMockMode) {
      return;
    }
    try {
      const data = await fetchSchedules(requestContext);
      setSchedules(data);
    } catch (error) {
      if (error.message !== SESSION_EXPIRED_ERROR) {
        console.error("Error fetching schedules", error);
      }
    }
  }, [isMockMode, requestContext]);

  const checkProgress = useCallback(async () => {
    try {
      const data = await fetchUpdateStatus(requestContext);
      if (data.is_running) {
        setProgress(data);
        startPolling(checkProgress, 1000);
      } else {
        stopPolling();
        setProgress(DEFAULT_PROGRESS);
        await loadProjects();
        await loadHistory(false);
      }
    } catch (error) {
      if (error.message !== SESSION_EXPIRED_ERROR) {
        console.error("Error checking progress", error);
      }
    }
  }, [loadHistory, loadProjects, requestContext, startPolling, stopPolling]);

  useEffect(() => {
    loadProjects();
    loadHistory();
    loadSchedules();
    checkProgress();
    return () => stopPolling();
  }, [checkProgress, loadHistory, loadProjects, loadSchedules, stopPolling]);

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/login";
    } catch (error) {
      console.error("Error logging out", error);
    }
  };

  const handleUpdateProject = async (name) => {
    setUpdatingProjects((prev) => ({ ...prev, [name]: true }));

    if (isMockMode) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } else {
      try {
        await updateProject(name, requestContext);
        await loadProjects();
      } catch (error) {
        if (error.message !== SESSION_EXPIRED_ERROR) {
          alert(t("alerts.backend_error"));
        }
      }
    }

    setUpdatingProjects((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleUpdateAll = async () => {
    if (!confirm(t("alerts.update_all_confirm"))) {
      return;
    }

    if (isMockMode) {
      alert(t("alerts.mock_global"));
      return;
    }

    try {
      await triggerUpdateAll(requestContext);
      setProgress({
        is_running: true,
        current: 0,
        total: 1,
        current_project: t("status.starting"),
      });
      startPolling(checkProgress, 1000);
    } catch (error) {
      if (error.message !== SESSION_EXPIRED_ERROR) {
        alert(t("alerts.backend_error"));
      }
    }
  };

  const handleCreateSchedule = async (event) => {
    event.preventDefault();

    const formData = new FormData(event.target);
    const hour = Number.parseInt(formData.get("hour"), 10);
    const minute = Number.parseInt(formData.get("minute"), 10);
    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      alert(t("alerts.schedule_error"));
      return;
    }

    const payload = {
      target: formData.get("target"),
      task_type: "cron",
      frequency: formData.get("frequency"),
      week_day: formData.get("week_day") || "*",
      day_of_month: formData.get("day_of_month") || "1",
      hour,
      minute,
    };

    try {
      await createSchedule(payload, requestContext);
      await loadSchedules();
      event.target.reset();
      setSelectedFreq("daily");
    } catch (error) {
      if (error.message !== SESSION_EXPIRED_ERROR) {
        alert(t("alerts.schedule_error"));
      }
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!confirm(t("alerts.delete_schedule_confirm"))) {
      return;
    }
    try {
      await deleteSchedule(id, requestContext);
      await loadSchedules();
    } catch (error) {
      if (error.message !== SESSION_EXPIRED_ERROR) {
        alert(t("alerts.schedule_error"));
      }
    }
  };

  const toggleSetting = async (name, setting) => {
    setProjects((prev) =>
      prev.map((project) => {
        if (project.name !== name) {
          return project;
        }
        if (setting === "exclude") {
          return { ...project, excluded: !project.excluded };
        }
        if (setting === "fullstop") {
          return { ...project, full_stop: !project.full_stop };
        }
        return project;
      })
    );

    if (isMockMode) {
      return;
    }

    try {
      await toggleProjectSetting(name, setting, requestContext);
      await loadProjects();
    } catch (error) {
      setProjects((prev) =>
        prev.map((project) => {
          if (project.name !== name) {
            return project;
          }
          if (setting === "exclude") {
            return { ...project, excluded: !project.excluded };
          }
          if (setting === "fullstop") {
            return { ...project, full_stop: !project.full_stop };
          }
          return project;
        })
      );
      if (error.message !== SESSION_EXPIRED_ERROR) {
        alert(t("alerts.config_error"));
      }
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === "es" ? "en" : "es";
    i18n.changeLanguage(newLang);
  };

  const formatExpression = (expression) => {
    if (!expression) {
      return "";
    }

    const parts = expression.split(" ");
    const minute = (parts[0] || "0").padStart(2, "0");
    const hour = parts[1] || "0";
    const day = parts[2] || "*";
    const week = parts[4] || "*";

    if (day === "*" && week === "*") {
      return t("schedule.format.daily", { time: `${hour}:${minute}` });
    }
    if (week !== "*") {
      const translatedDay = t(`days.${week}`) !== `days.${week}` ? t(`days.${week}`) : week;
      return t("schedule.format.weekly", { day: translatedDay, time: `${hour}:${minute}` });
    }
    if (day !== "*") {
      return t("schedule.format.monthly", { day, time: `${hour}:${minute}` });
    }
    return expression;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <Header
        t={t}
        i18n={i18n}
        isMockMode={isMockMode}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onToggleLanguage={toggleLanguage}
        onLogout={handleLogout}
      />

      <ProgressBar t={t} progress={progress} />

      <main className="max-w-7xl mx-auto p-4 md:p-6 w-full flex-grow">
        {activeTab === "dashboard" && (
          <Dashboard
            t={t}
            projects={projects}
            progress={progress}
            updatingProjects={updatingProjects}
            onUpdateAll={handleUpdateAll}
            onUpdateProject={handleUpdateProject}
            onToggleSetting={toggleSetting}
          />
        )}

        {activeTab === "schedule" && (
          <ScheduleView
            t={t}
            selectedFreq={selectedFreq}
            onSelectedFreqChange={setSelectedFreq}
            onCreateSchedule={handleCreateSchedule}
            projects={projects}
            schedules={schedules}
            onDeleteSchedule={handleDeleteSchedule}
            formatExpression={formatExpression}
          />
        )}

        {activeTab === "history" && (
          <HistoryView
            t={t}
            history={history}
            historyLoading={historyLoading}
            onRefresh={loadHistory}
            onSelectLog={setSelectedLog}
          />
        )}

        <LogModal t={t} selectedLog={selectedLog} onClose={() => setSelectedLog(null)} />
      </main>

      <Footer t={t} />
    </div>
  );
}
