export const API_URL = "/api";
export const SESSION_EXPIRED_ERROR = "Sesión expirada";

export function isBackendUnreachableError(error) {
  if (!error) {
    return false;
  }
  if (error instanceof TypeError) {
    return true;
  }
  const msg = typeof error.message === "string" ? error.message : "";
  return /failed to fetch|networkerror|load failed|network request failed/i.test(msg);
}

function projectSegment(name) {
  return encodeURIComponent(name);
}

export async function handleAuthError(response, options = {}) {
  if (response.status === 401) {
    if (typeof options.onUnauthorized === "function") {
      options.onUnauthorized();
    }
    throw new Error(SESSION_EXPIRED_ERROR);
  }
  return response;
}

async function request(path, options = {}, context = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  await handleAuthError(response, context);
  return response;
}

async function readJsonBody(response) {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    const preview = text.length > 200 ? `${text.slice(0, 200)}…` : text;
    throw new Error(`Respuesta no JSON (${response.status}): ${preview}`);
  }
}

function errorMessageFromBody(data, status) {
  if (data && typeof data === "object") {
    const detail = data.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0 && detail[0]?.msg) {
      return detail.map((d) => d.msg).join("; ");
    }
  }
  return `Request failed (${status})`;
}

async function assertOk(response) {
  if (!response.ok) {
    let data = null;
    try {
      data = await readJsonBody(response);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    throw new Error(errorMessageFromBody(data, response.status));
  }
}

async function requestJson(path, options = {}, context = {}) {
  const response = await request(path, options, context);
  await assertOk(response);
  return readJsonBody(response);
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
  await assertOk(response);
}

export async function updateProject(name, context = {}) {
  const response = await request(
    `/projects/${projectSegment(name)}/update`,
    { method: "POST" },
    context
  );
  await assertOk(response);
  return readJsonBody(response);
}

export async function toggleProjectSetting(name, setting, context = {}) {
  const response = await request(
    `/projects/${projectSegment(name)}/toggle_${setting}`,
    { method: "POST" },
    context
  );
  await assertOk(response);
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
  await assertOk(response);
  return readJsonBody(response);
}

export async function deleteSchedule(id, context = {}) {
  const response = await request(`/schedules/${id}`, { method: "DELETE" }, context);
  await assertOk(response);
}

export async function logout() {
  await fetch("/logout", { method: "POST" });
}
