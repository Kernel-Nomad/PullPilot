import { X } from "lucide-react";

function safeStringifyDetails(details) {
  try {
    return JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    return String(details ?? "");
  }
}

export default function LogModal({ t, selectedLog, onClose }) {
  if (!selectedLog) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">
            {t("modal.title", { id: selectedLog.id })}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto font-mono text-xs bg-slate-900 text-slate-300">
          <pre className="whitespace-pre-wrap">{safeStringifyDetails(selectedLog.details)}</pre>
        </div>
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
          >
            {t("modal.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
