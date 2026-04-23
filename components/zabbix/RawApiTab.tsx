"use client";

import { useState } from "react";
import { useZabbixStore } from "@/store/useZabbixStore";
import { zabbixCall } from "@/lib/zabbix";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { IconCode, IconCopy, IconPlayerPlay } from "@tabler/icons-react";
import { toast } from "sonner";

export function RawApiTab() {
  const { url, token } = useZabbixStore();
  const [method, setMethod] = useState("host.get");
  const [params, setParams] = useState(`{\n  "output": ["hostid","name"],\n  "limit": 5\n}`);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function callApi() {
    if (!method.trim()) { toast.error("Entrez une méthode."); return; }
    let parsed = {};
    if (params.trim()) {
      try { parsed = JSON.parse(params); }
      catch (e: any) { toast.error(`JSON invalide : ${e.message}`); return; }
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await zabbixCall(url, token, method.trim(), parsed);
      setResult(JSON.stringify(res, null, 2));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result);
    toast.success("Copié !");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconCode className="size-4 text-muted-foreground" />
            Requête
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Méthode</Label>
            <Input
              placeholder="host.get"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Paramètres <span className="text-muted-foreground">(JSON)</span></Label>
            <Textarea
              className="font-mono text-xs min-h-[200px]"
              value={params}
              onChange={(e) => setParams(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) callApi(); }}
              placeholder="{}"
            />
            <p className="text-xs text-muted-foreground">Ctrl+Entrée pour exécuter</p>
          </div>
          <Button className="w-full" onClick={callApi} disabled={loading}>
            <IconPlayerPlay className="size-4 mr-2" />
            {loading ? "Exécution…" : "Exécuter"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <IconCode className="size-4 text-muted-foreground" />
              Résultat
            </CardTitle>
            {result && (
              <Button variant="ghost" size="sm" onClick={copy}>
                <IconCopy className="size-4 mr-1.5" />
                Copier
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!result ? (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
              Aucun résultat — exécutez une requête.
            </div>
          ) : (
            <pre className="text-xs font-mono bg-muted rounded-md p-3 overflow-auto max-h-[400px] whitespace-pre-wrap break-words">
              {result}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
