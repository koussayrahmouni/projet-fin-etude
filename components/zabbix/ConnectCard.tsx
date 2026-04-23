"use client";

import { useState } from "react";
import { useZabbixStore } from "@/store/useZabbixStore";
import { zabbixCall } from "@/lib/zabbix";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { IconServer, IconKey, IconUser, IconLock, IconPlugConnected, IconPlugConnectedX } from "@tabler/icons-react";
import { toast } from "sonner";

export function ConnectCard() {
  const { url, token, connected, setUrl, setToken, setHosts, setConnected, disconnect } = useZabbixStore();

  const [formUrl, setFormUrl] = useState(url || "");
  const [formUser, setFormUser] = useState("");
  const [formPass, setFormPass] = useState("");
  const [formToken, setFormToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    if (!formUrl) { toast.error("L'URL de l'API Zabbix est requise."); return; }

    setLoading(true);
    try {
      let authToken = "";

      if (formToken) {
        // verify token by calling apiinfo.version
        setUrl(formUrl);
        await zabbixCall(formUrl, formToken, "apiinfo.version");
        authToken = formToken;
      } else {
        if (!formUser) throw new Error("Le nom d'utilisateur est requis.");
        try {
          authToken = await zabbixCall(formUrl, "", "user.login", { username: formUser, password: formPass });
        } catch {
          authToken = await zabbixCall(formUrl, "", "user.login", { user: formUser, password: formPass });
        }
      }

      setUrl(formUrl);
      setToken(authToken);
      setConnected(true);

      // prefetch hosts
      const hosts = await zabbixCall(formUrl, authToken, "host.get", {
        output: ["hostid", "host", "name", "status", "available"],
        limit: 500,
      });
      setHosts(hosts);

      toast.success("Connecté à Zabbix avec succès !");
    } catch (err: any) {
      toast.error(`Connexion échouée : ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleDisconnect() {
    disconnect();
    setFormToken("");
    setFormUser("");
    setFormPass("");
    toast.info("Déconnecté de Zabbix.");
  }

  if (connected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <IconPlugConnected className="size-4 text-green-500" />
              Connecté
            </CardTitle>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400">
              En ligne
            </Badge>
          </div>
          <CardDescription className="font-mono text-xs truncate">{url}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-destructive hover:text-destructive">
            <IconPlugConnectedX className="size-4 mr-2" />
            Déconnecter
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconServer className="size-4" />
          Connexion Zabbix
        </CardTitle>
        <CardDescription>
          Entrez l'URL de votre API Zabbix et vos identifiants.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="z-url">URL de l'API</Label>
          <Input
            id="z-url"
            placeholder="https://zabbix.example.com/api_jsonrpc.php"
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
          />
        </div>

        <Separator />
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Identifiants</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="z-user">
              <IconUser className="size-3 inline mr-1" />
              Utilisateur
            </Label>
            <Input
              id="z-user"
              placeholder="Admin"
              value={formUser}
              onChange={(e) => setFormUser(e.target.value)}
              disabled={!!formToken}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="z-pass">
              <IconLock className="size-3 inline mr-1" />
              Mot de passe
            </Label>
            <Input
              id="z-pass"
              type="password"
              value={formPass}
              onChange={(e) => setFormPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              disabled={!!formToken}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="z-token">
            <IconKey className="size-3 inline mr-1" />
            API Token <span className="text-muted-foreground">(optionnel, remplace login/pass)</span>
          </Label>
          <Input
            id="z-token"
            placeholder="Coller votre token API ici"
            value={formToken}
            onChange={(e) => setFormToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          />
        </div>

        <Button className="w-full" onClick={handleConnect} disabled={loading}>
          {loading ? "Connexion en cours…" : "Se connecter"}
        </Button>
      </CardContent>
    </Card>
  );
}
