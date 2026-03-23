import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

const resources = {
  es: {
    translation: {
      app: {
        title: "PullPilot",
        subtitle: "Docker Homelab Updater",
        demo_mode: "DEMO",
      },
      nav: {
        dashboard: "Dashboard",
        schedule: "Programacion",
        history: "Historial",
      },
      auth: {
        logout: "Cerrar sesion",
      },
      status: {
        updating_homelab: "Actualizando Homelab...",
        processing: "Procesando",
        system_status: "Estado del Sistema",
        projects_detected: "{{count}} proyectos detectados.",
        active: "{{count}} activos.",
        update_all: "Actualizar Todo",
        updating: "Actualizando...",
        updating_btn: "Actualizando...",
      },
      card: {
        containers: "Contenedores",
        full_stop: "Full Stop Update",
        exclude: "Excluir (Ignorar)",
      },
      schedule: {
        new_schedule: "Nueva Programacion",
        target: "Objetivo",
        target_global: "Todo el Sistema (Global)",
        frequency: "Frecuencia",
        freq_daily: "Diaria",
        freq_weekly: "Semanal",
        freq_monthly: "Mensual",
        day_week: "Dia Semana",
        day_month: "Dia del Mes",
        time: "Hora (24h)",
        create_btn: "Crear Tarea",
        active_tasks: "Tareas Activas",
        tasks_count: "{{count}} Tareas",
        no_tasks: "No hay tareas programadas.",
        format: {
          daily: "Diaria a las {{time}}",
          weekly: "Semanal ({{day}}) a las {{time}}",
          monthly: "Mensual (Dia {{day}}) a las {{time}}",
        },
      },
      history: {
        title: "Historial de Actualizaciones",
        table_status: "Estado",
        table_date: "Fecha",
        table_summary: "Resumen",
        table_actions: "Acciones",
        status_success: "Exitoso",
        status_error: "Error",
        view_details: "Ver Detalles",
        no_logs: "No hay registros de actualizaciones aun.",
      },
      modal: {
        title: "Detalles del Log #{{id}}",
        close: "Cerrar",
      },
      alerts: {
        update_all_confirm: "Seguro que quieres actualizar TODO el homelab?",
        delete_schedule_confirm: "Eliminar programacion?",
        backend_error: "Error al conectar con el backend",
        mock_global: "(Simulacion) Proceso global iniciado en segundo plano.",
        schedule_error: "Error al crear programacion",
        config_error: "Error al guardar configuracion",
      },
      days: {
        mon: "Lunes",
        tue: "Martes",
        wed: "Miercoles",
        thu: "Jueves",
        fri: "Viernes",
        sat: "Sabado",
        sun: "Domingo",
      },
      footer: {
        tip_me: "Tip me",
      },
    },
  },
  en: {
    translation: {
      app: {
        title: "PullPilot",
        subtitle: "Docker Homelab Updater",
        demo_mode: "DEMO",
      },
      nav: {
        dashboard: "Dashboard",
        schedule: "Schedule",
        history: "History",
      },
      auth: {
        logout: "Logout",
      },
      status: {
        updating_homelab: "Updating Homelab...",
        processing: "Processing",
        system_status: "System Status",
        projects_detected: "{{count}} projects detected.",
        active: "{{count}} active.",
        update_all: "Update All",
        updating: "Updating...",
        updating_btn: "Updating...",
      },
      card: {
        containers: "Containers",
        full_stop: "Full Stop Update",
        exclude: "Exclude (Ignore)",
      },
      schedule: {
        new_schedule: "New Schedule",
        target: "Target",
        target_global: "Whole System (Global)",
        frequency: "Frequency",
        freq_daily: "Daily",
        freq_weekly: "Weekly",
        freq_monthly: "Monthly",
        day_week: "Day of Week",
        day_month: "Day of Month",
        time: "Time (24h)",
        create_btn: "Create Task",
        active_tasks: "Active Tasks",
        tasks_count: "{{count}} Tasks",
        no_tasks: "No scheduled tasks.",
        format: {
          daily: "Daily at {{time}}",
          weekly: "Weekly ({{day}}) at {{time}}",
          monthly: "Monthly (Day {{day}}) at {{time}}",
        },
      },
      history: {
        title: "Update History",
        table_status: "Status",
        table_date: "Date",
        table_summary: "Summary",
        table_actions: "Actions",
        status_success: "Success",
        status_error: "Error",
        view_details: "View Details",
        no_logs: "No update records yet.",
      },
      modal: {
        title: "Log Details #{{id}}",
        close: "Close",
      },
      alerts: {
        update_all_confirm: "Are you sure you want to update the ENTIRE homelab?",
        delete_schedule_confirm: "Delete schedule?",
        backend_error: "Error connecting to backend",
        mock_global: "(Simulation) Global process started in background.",
        schedule_error: "Error creating schedule",
        config_error: "Error saving configuration",
      },
      days: {
        mon: "Monday",
        tue: "Tuesday",
        wed: "Wednesday",
        thu: "Thursday",
        fri: "Friday",
        sat: "Saturday",
        sun: "Sunday",
      },
      footer: {
        tip_me: "Tip me",
      },
    },
  },
};

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources,
  fallbackLng: "es",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
