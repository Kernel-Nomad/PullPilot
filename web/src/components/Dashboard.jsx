import { Loader2, RefreshCw } from "lucide-react";

import ProjectCard from "./ProjectCard";

export default function Dashboard({
  t,
  projects,
  progress,
  updatingProjects,
  onUpdateAll,
  onUpdateProject,
  onToggleSetting,
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-blue-50 p-6 rounded-xl border border-blue-100 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-blue-900">{t("status.system_status")}</h2>
          <p className="text-blue-700 text-sm mt-1">
            {t("status.projects_detected", { count: projects.length })}{" "}
            {t("status.active", { count: projects.filter((p) => p.status === "running").length })}
          </p>
        </div>
        <button
          onClick={onUpdateAll}
          disabled={progress.is_running}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-md transition-all active:scale-95 font-medium disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {progress.is_running ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <RefreshCw size={20} />
          )}
          {progress.is_running ? t("status.updating_btn") : t("status.update_all")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <ProjectCard
            key={project.name}
            project={project}
            t={t}
            isUpdatingThis={Boolean(updatingProjects[project.name])}
            isGlobalUpdate={progress.is_running}
            currentProject={progress.current_project}
            onUpdateProject={onUpdateProject}
            onToggleSetting={onToggleSetting}
          />
        ))}
      </div>
    </div>
  );
}
