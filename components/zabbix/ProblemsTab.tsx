"use client";

import { useState, useEffect } from "react";
import { useZabbixStore } from "@/store/useZabbixStore";
import { zabbixCall, ZabbixProblem, ZabbixTrigger, fmtTime, fmtDuration, inBusinessHours } from "@/lib/zabbix";
import { SeverityBadge } from "./SeverityBadge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { IconRefresh, IconSearch, IconCircleCheck } from "@tabler/icons-react";
import { toast } from "sonner";

export function ProblemsTab() {
  const { url, token } = useZabbixStore();
  const [problems, setProblems] = useState<ZabbixProblem[]>([]);
  const [triggerMap, setTriggerMap] = useState<Record<string, ZabbixTrigger>>({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const raw = await zabbixCall(url, token, "problem.get", {
        output: "extend",
        selectAcknowledges: "count",
        recent: true,
        sortfield: "eventid",
        sortorder: "DESC",
        limit: 200,
      });

      const triggerIds = [...new Set<string>(raw.map((p: ZabbixProblem) => p.objectid))];
      let tMap: Record<string, ZabbixTrigger> = {};
      if (triggerIds.length) {
        const triggers = await zabbixCall(url, token, "trigger.get", {
          triggerids: triggerIds,
          output: ["triggerid", "description"],
          selectHosts: ["host", "name"],
        });
        triggers.forEach((t: ZabbixTrigger) => { tMap[t.triggerid] = t; });
      }

      setProblems(raw);
      setTriggerMap(tMap);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = problems
    .filter((p) => inBusinessHours(p.clock))
    .filter((p) => {
      const q = query.toLowerCase();
      const t = triggerMap[p.objectid];
      return (
        p.name?.toLowerCase().includes(q) ||
        t?.hosts?.[0]?.name?.toLowerCase().includes(q) ||
        t?.description?.toLowerCase().includes(q)
      );
    });

  const hidden = problems.filter((p) => !inBusinessHours(p.clock)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un problème…"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <IconRefresh className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
        <Badge variant="destructive">{filtered.length} actif{filtered.length !== 1 ? "s" : ""}</Badge>
        {hidden > 0 && (
          <span className="text-xs text-muted-foreground">{hidden} hors horaires masqué{hidden > 1 ? "s" : ""}</span>
        )}
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sévérité</TableHead>
              <TableHead>Hôte</TableHead>
              <TableHead>Problème</TableHead>
              <TableHead>Depuis</TableHead>
              <TableHead>Durée</TableHead>
              <TableHead>ACK</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <IconCircleCheck className="size-8 mx-auto mb-2 text-green-500 opacity-70" />
                  <p className="text-green-600 dark:text-green-400 font-medium">Aucun problème actif</p>
                </TableCell>
              </TableRow>
            ) : filtered.map((p) => {
              const trigger = triggerMap[p.objectid];
              const host = trigger?.hosts?.[0]?.name ?? trigger?.hosts?.[0]?.host ?? "—";
              const name = trigger?.description ?? p.name ?? "—";
              const acked = p.acknowledged && p.acknowledged !== "0";

              return (
                <TableRow key={p.eventid}>
                  <TableCell><SeverityBadge severity={p.severity} /></TableCell>
                  <TableCell className="font-medium">{host}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm">{name}</TableCell>
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
      </Card>
    </div>
  );
}
