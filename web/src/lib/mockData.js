export const MOCK_PROJECTS = [
  {
    name: "plex-media-server",
    status: "running",
    containers: 1,
    excluded: false,
    full_stop: false,
  },
  {
    name: "pihole-dns",
    status: "running",
    containers: 2,
    excluded: false,
    full_stop: true,
  },
  {
    name: "vaultwarden",
    status: "stopped",
    containers: 0,
    excluded: true,
    full_stop: false,
  },
  {
    name: "home-assistant",
    status: "running",
    containers: 3,
    excluded: false,
    full_stop: false,
  },
  {
    name: "nginx-proxy-manager",
    status: "partial",
    containers: 1,
    excluded: false,
    full_stop: false,
  },
];

export const MOCK_HISTORY = [
  {
    id: 1,
    status: "SUCCESS",
    timestamp: new Date().toISOString(),
    summary: "plex-media-server: OK, pihole-dns: OK",
    details: "{}",
  },
  {
    id: 2,
    status: "ERROR",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    summary: "vaultwarden: ERROR",
    details: '{"error": "Connection timed out"}',
  },
  {
    id: 3,
    status: "SUCCESS",
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    summary: "Actualizacion global completada",
    details: "{}",
  },
];
