"use client";

import { useState } from "react";
import { useZabbixStore } from "@/store/useZabbixStore";
import { zabbixCall, ZabbixItem, ZabbixHost, fmtTime, VALUE_TYPES } from "@/lib/zabbix";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconSearch } from "@tabler/icons-react";
import { toast } from "sonner";

export function ItemsTab() {
  const { url, token, hosts } = useZabbixStore();
  const [items, setItems] = useState<ZabbixItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedHost, setSelectedHost] = useState("");

  const sorted = [...hosts].sort((a, b) =>
    (a.name || a.host).localeCompare(b.name || b.host)
  );

  async function handleHostChange(hostid: string) {
    setSelectedHost(hostid);
    if (!hostid) { setItems([]); return; }
    setLoading(true);
    try {
      const data = await zabbixCall(url, token, "item.get", {
        output: ["itemid", "name", "key_", "lastvalue", "lastclock", "value_type", "units"],
        hostids: [hostid],
        sortfield: "name",
        limit: 300,
      });
      setItems(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = items.filter((it) => {
    const q = query.toLowerCase();
    return it.name?.toLowerCase().includes(q) || it.key_?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="space-y-1 min-w-[260px]">
          <Label className="text-xs text-muted-foreground">Hôte</Label>
          <Select value={selectedHost} onValueChange={handleHostChange}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Sélectionner un hôte…" />
            </SelectTrigger>
            <SelectContent>
              {sorted.map((h: ZabbixHost) => (
                <SelectItem key={h.hostid} value={h.hostid}>{h.name || h.host}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedHost && (
          <div className="relative mt-5">
            <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un item…"
              className="pl-8 w-[220px]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {items.length > 0 && (
          <span className="text-sm text-muted-foreground mt-5">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {!selectedHost ? (
        <Card className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Sélectionnez un hôte pour afficher ses items.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Clé</TableHead>
                <TableHead>Dernière valeur</TableHead>
                <TableHead>Mis à jour</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    Aucun item trouvé.
                  </TableCell>
                </TableRow>
              ) : filtered.map((it) => (
                <TableRow key={it.itemid}>
                  <TableCell className="font-medium text-sm">{it.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">{it.key_}</TableCell>
                  <TableCell className="text-sm">
                    {it.lastvalue ?? "—"}
                    {it.units ? <span className="text-muted-foreground ml-1 text-xs">{it.units}</span> : null}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtTime(it.lastclock)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {VALUE_TYPES[Number(it.value_type)] ?? "?"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
