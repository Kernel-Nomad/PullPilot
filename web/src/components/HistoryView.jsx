import { CheckCircle, Loader2, RefreshCw, XCircle } from "lucide-react";

export default function HistoryView({ t, history, historyLoading, onRefresh, onSelectLog }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800">{t("history.title")}</h2>
        <button
          onClick={onRefresh}
          disabled={historyLoading}
          aria-label={t("history.refresh")}
          title={t("history.refresh")}
          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <RefreshCw size={18} className={historyLoading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-xs">
            <tr>
              <th className="px-6 py-4">{t("history.table_status")}</th>
              <th className="px-6 py-4">{t("history.table_date")}</th>
              <th className="px-6 py-4">{t("history.table_summary")}</th>
              <th className="px-6 py-4">{t("history.table_actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {historyLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {t("history.refresh")}
                  </span>
                </td>
              </tr>
            ) : (
              <>
                {history.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      {log.status === "SUCCESS" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                          <CheckCircle size={14} /> {t("history.status_success")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                          <XCircle size={14} /> {t("history.status_error")}
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
                        onClick={() => onSelectLog(log)}
                        className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                      >
                        {t("history.view_details")}
                      </button>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                      {t("history.no_logs")}
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
