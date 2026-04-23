"use client";

import { useState, useEffect } from "react";
import { useZabbixStore } from "@/store/useZabbixStore";
import { zabbixCall, ZabbixHost } from "@/lib/zabbix";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { IconRefresh, IconSearch, IconServer } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const AVAIL: Record<string, [string, string]> = {
  "0": ["bg-muted text-muted-foreground border-border", "Inconnu"],
  "1": ["bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400", "Disponible"],
  "2": ["bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400", "Indisponible"],
};

export function HostsTab() {
  const { url, token } = useZabbixStore();
  const [hosts, setHosts] = useState<ZabbixHost[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await zabbixCall(url, token, "host.get", {
        output: ["hostid", "host", "name", "status", "available"],
        selectInterfaces: ["ip", "dns", "port", "type"],
        selectGroups: ["groupid", "name"],
        limit: 500,
      });
      setHosts(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = hosts.filter((h) => {
    const q = query.toLowerCase();
    return (
      h.name?.toLowerCase().includes(q) ||
      h.host?.toLowerCase().includes(q) ||
      h.interfaces?.some((i) => i.ip?.includes(q) || i.dns?.includes(q)) ||
      h.groups?.some((g) => g.name?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un hôte…"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <IconRefresh className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
        <span className="text-sm text-muted-foreground">{filtered.length} hôte{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Disponibilité</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Groupes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  <IconServer className="size-8 mx-auto mb-2 opacity-30" />
                  Aucun hôte trouvé.
                </TableCell>
              </TableRow>
            ) : filtered.map((h) => {
              const iface = h.interfaces?.[0];
              const ip = iface?.ip || iface?.dns || "—";
              const [avClass, avLabel] = AVAIL[h.available] ?? AVAIL["0"];

              return (
                <TableRow key={h.hostid}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{h.hostid}</TableCell>
                  <TableCell>
                    <p className="font-medium">{h.name || h.host}</p>
                    {h.name !== h.host && <p className="text-xs text-muted-foreground">{h.host}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={h.status === "0"
                      ? "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400"
                      : "bg-muted text-muted-foreground border-border"}>
                      {h.status === "0" ? "Activé" : "Désactivé"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={avClass}>{avLabel}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{ip}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {h.groups?.map((g) => (
                        <Badge key={g.groupid} variant="secondary" className="text-xs">{g.name}</Badge>
                      )) ?? "—"}
                    </div>
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
