"use client";

import { useState } from "react";
import { useZabbixStore } from "@/store/useZabbixStore";
import { zabbixCall, ZabbixHost, ZabbixTrigger, ZabbixProblem, fmtTime, fmtDuration } from "@/lib/zabbix";
import { SeverityBadge } from "./SeverityBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  IconServer, IconPlug, IconTag, IconClipboard, IconCode,
  IconBell, IconAlertTriangle, IconCircleCheck,
} from "@tabler/icons-react";
import { toast } from "sonner";

const IFTYPE: Record<string, string> = { "1": "Agent", "2": "SNMP", "3": "IPMI", "4": "JMX" };
const AVAIL: Record<string, [string, string]> = {
  "0": ["bg-muted text-muted-foreground border-border", "Inconnu"],
  "1": ["bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400", "Disponible"],
  "2": ["bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400", "Indisponible"],
};

const INV_KEYS: [string, string][] = [
  ["type", "Type"], ["os", "OS"], ["os_full", "OS (complet)"], ["os_short", "OS (abrégé)"],
  ["serialno_a", "N° Série"], ["asset_tag", "Étiquette"], ["macaddress_a", "MAC A"],
  ["hardware", "Matériel"], ["software", "Logiciel"], ["contact", "Contact"],
  ["location", "Localisation"], ["vendor", "Fabricant"], ["model", "Modèle"],
  ["deployment_status", "Déploiement"], ["notes", "Notes"],
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 text-sm border-b border-border/50 last:border-0">
      <span className="text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  );
}

export function ClientDetailTab() {
  const { url, token, hosts } = useZabbixStore();
  const [loading, setLoading] = useState(false);
  const [host, setHost] = useState<ZabbixHost | null>(null);
  const [triggers, setTriggers] = useState<ZabbixTrigger[]>([]);
  const [activeProblems, setActiveProblems] = useState<ZabbixProblem[]>([]);

  const sorted = [...hosts].sort((a, b) =>
    (a.name || a.host).localeCompare(b.name || b.host)
  );

  async function handleHostChange(hostid: string) {
    if (!hostid) return;
    setLoading(true);
    setHost(null);
    setTriggers([]);
    setActiveProblems([]);

    try {
      const [hosts, trigs, probs] = await Promise.all([
        zabbixCall(url, token, "host.get", {
          hostids: [hostid],
          output: "extend",
          selectInterfaces: "extend",
          selectGroups: ["groupid", "name"],
          selectTemplates: ["templateid", "name"],
          selectInventory: "extend",
          selectMacros: ["macro", "value"],
          selectTags: "extend",
          limit: 1,
        }),
        zabbixCall(url, token, "trigger.get", {
          hostids: [hostid],
          output: ["triggerid", "description", "priority", "status", "value", "lastchange"],
          sortfield: "priority",
          sortorder: "DESC",
          limit: 50,
        }),
        zabbixCall(url, token, "problem.get", {
          output: "extend",
          hostids: [hostid],
          recent: true,
          sortfield: "eventid",
          sortorder: "DESC",
        }),
      ]);

      if (!hosts[0]) throw new Error("Hôte introuvable.");
      setHost(hosts[0]);
      setTriggers(trigs);
      setActiveProblems(probs);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-w-xs space-y-1">
        <Label className="text-xs text-muted-foreground">Client</Label>
        <Select onValueChange={handleHostChange}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un client…" />
          </SelectTrigger>
          <SelectContent>
            {sorted.map((h) => (
              <SelectItem key={h.hostid} value={h.hostid}>{h.name || h.host}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
              <CardContent className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-4 w-full" />)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && host && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ── Basic Info ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <IconServer className="size-4 text-muted-foreground" />
                Informations générales
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-0">
              <Row label="ID"><code className="text-xs text-muted-foreground">{host.hostid}</code></Row>
              <Row label="Nom technique">{host.host}</Row>
              <Row label="Nom affiché"><strong>{host.name}</strong></Row>
              <Row label="Statut">
                <Badge variant="outline" className={host.status === "0"
                  ? "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400"
                  : "bg-muted text-muted-foreground"}>
                  {host.status === "0" ? "Activé" : "Désactivé"}
                </Badge>
              </Row>
              <Row label="Disponibilité">
                {(() => { const [cls, lbl] = AVAIL[host.available] ?? AVAIL["0"]; return <Badge variant="outline" className={cls}>{lbl}</Badge>; })()}
              </Row>
              <Row label="SNMP">
                <Badge variant="outline" className={host.snmp_available === "1" ? "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400" : "bg-muted text-muted-foreground"}>
                  {host.snmp_available === "1" ? "Oui" : "Non"}
                </Badge>
              </Row>
              {host.description && <Row label="Description">{host.description}</Row>}
            </CardContent>
          </Card>

          {/* ── Interfaces ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <IconPlug className="size-4 text-muted-foreground" />
                Interfaces
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(host.interfaces ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-muted-foreground text-center py-4">Aucune interface</TableCell></TableRow>
                  ) : host.interfaces!.map((iface, i) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant="secondary">{IFTYPE[iface.type] ?? "?"}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{iface.ip || iface.dns || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{iface.port}</TableCell>
                      <TableCell>{iface.main === "1" && <Badge variant="outline" className="text-xs">Défaut</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* ── Classification ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <IconTag className="size-4 text-muted-foreground" />
                Classification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Groupes</p>
                <div className="flex flex-wrap gap-1.5">
                  {host.groups?.length ? host.groups.map((g) => (
                    <Badge key={g.groupid} variant="secondary">{g.name}</Badge>
                  )) : <span className="text-muted-foreground text-sm">—</span>}
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Templates</p>
                <div className="flex flex-wrap gap-1.5">
                  {host.templates?.length ? host.templates.map((t) => (
                    <Badge key={t.templateid} variant="outline" className="text-purple-600 border-purple-500/30 bg-purple-500/10 dark:text-purple-400">{t.name}</Badge>
                  )) : <span className="text-muted-foreground text-sm">—</span>}
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {host.tags?.length ? host.tags.map((t, i) => (
                    <Badge key={i} variant="outline" className="text-blue-600 border-blue-500/30 bg-blue-500/10 dark:text-blue-400">
                      {t.tag}{t.value ? `: ${t.value}` : ""}
                    </Badge>
                  )) : <span className="text-muted-foreground text-sm">—</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Inventory ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <IconClipboard className="size-4 text-muted-foreground" />
                Inventaire
              </CardTitle>
            </CardHeader>
            <CardContent>
              {INV_KEYS.filter(([k]) => host.inventory?.[k]?.trim()).length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucune donnée d'inventaire.</p>
              ) : INV_KEYS.filter(([k]) => host.inventory?.[k]?.trim()).map(([k, label]) => (
                <Row key={k} label={label}>{host.inventory![k]}</Row>
              ))}
            </CardContent>
          </Card>

          {/* ── User Macros ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <IconCode className="size-4 text-muted-foreground" />
                Macros utilisateur
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!host.macros?.length ? (
                <p className="text-muted-foreground text-sm px-6 py-4">Aucune macro définie.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Macro</TableHead>
                      <TableHead>Valeur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {host.macros!.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell><code className="text-xs text-primary">{m.macro}</code></TableCell>
                        <TableCell className="font-mono text-xs">{m.value || <span className="text-muted-foreground italic">vide</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* ── Problèmes En Cours ── */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <IconAlertTriangle className="size-4 text-muted-foreground" />
                Problèmes en cours
                {activeProblems.length > 0 && (
                  <Badge variant="destructive" className="ml-1">{activeProblems.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activeProblems.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 px-6 py-4 text-sm">
                  <IconCircleCheck className="size-4" />
                  Aucun problème actif sur ce client.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sévérité</TableHead>
                      <TableHead>Problème</TableHead>
                      <TableHead>Depuis</TableHead>
                      <TableHead>Durée</TableHead>
                      <TableHead>ACK</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeProblems.map((p) => {
                      const acked = p.acknowledged && p.acknowledged !== "0";
                      return (
                        <TableRow key={p.eventid}>
                          <TableCell><SeverityBadge severity={p.severity} /></TableCell>
                          <TableCell className="text-sm font-medium">{p.name || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtTime(p.clock)}</TableCell>
                          <TableCell className="text-xs font-mono">{fmtDuration(p.clock)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={acked
                              ? "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400"
                              : "bg-muted text-muted-foreground border-border"}>
                              {acked ? "ACK" : "Non ACK"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* ── Triggers ── */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <IconBell className="size-4 text-muted-foreground" />
                Triggers <span className="text-muted-foreground font-normal text-xs">(top 50 par sévérité)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sévérité</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead>Dernier changement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {triggers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground text-center py-6">Aucun trigger.</TableCell>
                    </TableRow>
                  ) : triggers.map((t) => (
                    <TableRow key={t.triggerid}>
                      <TableCell><SeverityBadge severity={t.priority} /></TableCell>
                      <TableCell className="text-sm">{t.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={t.value === "1"
                          ? "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400"
                          : "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400"}>
                          {t.value === "1" ? "PROBLÈME" : "OK"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtTime(t.lastchange)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && !host && (
        <Card className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Sélectionnez un client pour afficher ses détails.
        </Card>
      )}
    </div>
  );
}
