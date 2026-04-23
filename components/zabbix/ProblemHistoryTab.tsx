"use client";

import { useState } from "react";
import { useZabbixStore } from "@/store/useZabbixStore";
import { zabbixCall, ZabbixEvent, ZabbixHost, fmtTime, inBusinessHours, SEV_LABELS } from "@/lib/zabbix";
import { SeverityBadge } from "./SeverityBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { IconSearch, IconCircleCheck, IconTrendingUp } from "@tabler/icons-react";
import { toast } from "sonner";

interface AggregatedProblem {
  name: string;
  count: number;
  severity: number;
  lastSeen: number;
}

export function ProblemHistoryTab() {
  const { url, token, hosts } = useZabbixStore();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<ZabbixEvent[]>([]);
  const [ranked, setRanked] = useState<AggregatedProblem[]>([]);
  const [selectedHost, setSelectedHost] = useState("");
  const [days, setDays] = useState("30");
  const [loaded, setLoaded] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);

  const sorted = [...hosts].sort((a, b) =>
    (a.name || a.host).localeCompare(b.name || b.host)
  );

  async function load() {
    if (!selectedHost) { toast.error("Sélectionnez un client."); return; }
    setLoading(true);
    setLoaded(false);

    try {
      const timeFrom = Math.floor(Date.now() / 1000) - Number(days) * 86400;
      const raw = await zabbixCall(url, token, "event.get", {
        output: ["eventid", "objectid", "clock", "severity", "name"],
        hostids: [selectedHost],
        source: 0,
        object: 0,
        value: 1,
        time_from: timeFrom,
        sortfield: "clock",
        sortorder: "DESC",
        limit: 5000,
      });

      const filtered = raw.filter((e: ZabbixEvent) => inBusinessHours(e.clock));
      setHiddenCount(raw.length - filtered.length);
      setEvents(filtered);

      const freq: Record<string, AggregatedProblem> = {};
      filtered.forEach((e: ZabbixEvent) => {
        const key = e.name || `Trigger #${e.objectid}`;
        if (!freq[key]) freq[key] = { name: key, count: 0, severity: Number(e.severity ?? 0), lastSeen: 0 };
        freq[key].count++;
        if (Number(e.clock) > freq[key].lastSeen) freq[key].lastSeen = Number(e.clock);
      });
      setRanked(Object.values(freq).sort((a, b) => b.count - a.count));
      setLoaded(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalEvents = events.length;
  const maxCount = ranked[0]?.count || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1 min-w-[240px]">
          <Label className="text-xs text-muted-foreground">Client</Label>
          <Select value={selectedHost} onValueChange={setSelectedHost}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un client…" />
            </SelectTrigger>
            <SelectContent>
              {sorted.map((h: ZabbixHost) => (
                <SelectItem key={h.hostid} value={h.hostid}>{h.name || h.host}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Période</Label>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 derniers jours</SelectItem>
              <SelectItem value="14">14 derniers jours</SelectItem>
              <SelectItem value="30">30 derniers jours</SelectItem>
              <SelectItem value="90">90 derniers jours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={load} disabled={loading || !selectedHost}>
          <IconSearch className="size-4 mr-1.5" />
          {loading ? "Chargement…" : "Analyser"}
        </Button>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      )}

      {!loading && loaded && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total occurrences", value: totalEvents },
              { label: "Types de problèmes", value: ranked.length },
              { label: "Moy. / jour", value: (totalEvents / Number(days)).toFixed(1) },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {hiddenCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {hiddenCount} événement{hiddenCount > 1 ? "s" : ""} hors horaires (00h–08h) masqué{hiddenCount > 1 ? "s" : ""}.
            </p>
          )}

          {ranked.length === 0 ? (
            <Card className="flex items-center justify-center gap-2 py-12 text-green-600 dark:text-green-400">
              <IconCircleCheck className="size-5" />
              <span className="font-medium">Aucun problème sur cette période.</span>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Problème</TableHead>
                    <TableHead>Sévérité</TableHead>
                    <TableHead className="w-[220px]">Fréquence</TableHead>
                    <TableHead className="text-right w-20">Occurrences</TableHead>
                    <TableHead>Dernière occurrence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((r, i) => {
                    const pct = Math.round((r.count / maxCount) * 100);
                    return (
                      <TableRow key={r.name}>
                        <TableCell className="text-muted-foreground text-center">{i + 1}</TableCell>
                        <TableCell className="text-sm font-medium max-w-xs truncate">{r.name}</TableCell>
                        <TableCell><SeverityBadge severity={r.severity} /></TableCell>
                        <TableCell>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">{r.count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtTime(r.lastSeen)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {!loading && !loaded && (
        <Card className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <IconTrendingUp className="size-8 opacity-30" />
          <p className="text-sm">Sélectionnez un client et une période, puis cliquez sur Analyser.</p>
        </Card>
      )}
    </div>
  );
}
