export const API_URL = "/api";

export async function handleAuthError(response, options = {}) {
  if (response.status === 401) {
    if (typeof options.onUnauthorized === "function") {
      options.onUnauthorized();
    }
    throw new Error("Sesion expirada");
  }
  return response;
}

async function request(path, options = {}, context = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  await handleAuthError(response, context);
  return response;
}

async function requestJson(path, options = {}, context = {}) {
  const response = await request(path, options, context);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

export function fetchProjects(context = {}) {
  return requestJson("/projects", {}, context);
}

export function fetchHistory(context = {}) {
  return requestJson("/history", {}, context);
}

export function fetchSchedules(context = {}) {
  return requestJson("/schedules", {}, context);
}

export function fetchUpdateStatus(context = {}) {
  return requestJson("/update-status", {}, context);
}

export async function triggerUpdateAll(context = {}) {
  const response = await request("/update-all", { method: "POST" }, context);
  if (!response.ok) {
    throw new Error("No se pudo iniciar la actualizacion global");
  }
}

export async function updateProject(name, context = {}) {
  const response = await request(`/projects/${name}/update`, { method: "POST" }, context);
  if (!response.ok) {
    throw new Error("No se pudo actualizar el proyecto");
  }
  return response.json();
}

export async function toggleProjectSetting(name, setting, context = {}) {
  const response = await request(
    `/projects/${name}/toggle_${setting}`,
    { method: "POST" },
    context
  );
  if (!response.ok) {
    throw new Error("No se pudo guardar configuracion");
  }
}

export async function createSchedule(payload, context = {}) {
  const response = await request(
    "/schedules",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    context
  );
  if (!response.ok) {
    throw new Error("No se pudo crear la programacion");
  }
  return response.json();
}

export async function deleteSchedule(id, context = {}) {
  const response = await request(`/schedules/${id}`, { method: "DELETE" }, context);
  if (!response.ok) {
    throw new Error("No se pudo eliminar la programacion");
  }
}

export async function logout() {
  await fetch("/logout", { method: "POST" });
}
