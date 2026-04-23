// ── Zabbix API lib ────────────────────────────────────────────────
// All calls go through /api/zabbix proxy to avoid CORS.

export interface ZabbixHost {
  hostid: string;
  host: string;
  name: string;
  status: string;
  available: string;
  snmp_available?: string;
  ipmi_available?: string;
  jmx_available?: string;
  description?: string;
  interfaces?: ZabbixInterface[];
  groups?: { groupid: string; name: string }[];
  templates?: { templateid: string; name: string }[];
  inventory?: Record<string, string>;
  macros?: { macro: string; value: string }[];
  tags?: { tag: string; value: string }[];
}

export interface ZabbixInterface {
  type: string;
  ip: string;
  dns: string;
  port: string;
  main: string;
}

export interface ZabbixProblem {
  eventid: string;
  objectid: string;
  name: string;
  clock: string;
  severity: string;
  acknowledged: string;
}

export interface ZabbixTrigger {
  triggerid: string;
  description: string;
  priority: string;
  status: string;
  value: string;
  lastchange: string;
  hosts?: { host: string; name: string }[];
}

export interface ZabbixItem {
  itemid: string;
  name: string;
  key_: string;
  lastvalue: string;
  lastclock: string;
  value_type: string;
  units: string;
}

export interface ZabbixEvent {
  eventid: string;
  objectid: string;
  clock: string;
  severity: string;
  name: string;
  acknowledged: string;
}

export async function zabbixCall(
  url: string,
  token: string,
  method: string,
  params: object = {}
): Promise<any> {
  const body: any = { jsonrpc: "2.0", method, params, id: 1 };
  if (token && method !== "user.login" && method !== "apiinfo.version") {
    body.auth = token;
  }

  const res = await fetch("/api/zabbix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, body }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (data.error) {
    throw new Error(`[${data.error.code}] ${data.error.data || data.error.message}`);
  }
  return data.result;
}

export function fmtTime(unix: string | number): string {
  if (!unix || unix === "0") return "—";
  return new Date(Number(unix) * 1000).toLocaleString("fr-FR");
}

export function fmtDuration(unix: string | number): string {
  if (!unix || unix === "0") return "—";
  const secs = Math.floor(Date.now() / 1000) - Number(unix);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

export function inBusinessHours(unix: string | number): boolean {
  if (!unix || unix === "0") return true;
  return new Date(Number(unix) * 1000).getHours() >= 8;
}

export const SEV_LABELS = [
  "Non classé", "Information", "Attention", "Moyenne", "Haute", "Désastre",
];

export const SEV_TEXT: Record<number, string> = {
  0: "text-muted-foreground",
  1: "text-blue-500",
  2: "text-yellow-500",
  3: "text-orange-500",
  4: "text-red-500",
  5: "text-red-700 font-bold",
};

export const VALUE_TYPES = ["Float", "Char", "Log", "Uint", "Text"];
