"use client";

import { useZabbixStore } from "@/store/useZabbixStore";
import { ConnectCard } from "@/components/zabbix/ConnectCard";
import { HostsTab } from "@/components/zabbix/HostsTab";
import { ProblemsTab } from "@/components/zabbix/ProblemsTab";
import { ItemsTab } from "@/components/zabbix/ItemsTab";
import { ClientDetailTab } from "@/components/zabbix/ClientDetailTab";
import { ProblemHistoryTab } from "@/components/zabbix/ProblemHistoryTab";
import { RawApiTab } from "@/components/zabbix/RawApiTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  IconServer, IconAlertTriangle, IconList, IconUser,
  IconHistory, IconCode, IconPlugConnected, IconPlugConnectedX,
} from "@tabler/icons-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function ZabbixPage() {
  const { connected, url } = useZabbixStore();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-col gap-6 p-6 max-w-screen-2xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Zabbix Explorer</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Supervision et analyse de l'infrastructure Zabbix
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {connected ? (
                <>
                  <IconPlugConnected className="size-4 text-green-500" />
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400 font-mono text-xs max-w-[240px] truncate">
                    {url}
                  </Badge>
                </>
              ) : (
                <>
                  <IconPlugConnectedX className="size-4 text-muted-foreground" />
                  <Badge variant="outline" className="text-muted-foreground">Non connecté</Badge>
                </>
              )}
            </div>
          </div>

          {/* Connect card — always visible if disconnected, compact if connected */}
          <ConnectCard />

          {/* Main tabs — only shown when connected */}
          {connected && (
            <Tabs defaultValue="problems" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="problems" className="flex items-center gap-1.5">
                  <IconAlertTriangle className="size-3.5" />
                  Problèmes actifs
                </TabsTrigger>
                <TabsTrigger value="hosts" className="flex items-center gap-1.5">
                  <IconServer className="size-3.5" />
                  Hôtes
                </TabsTrigger>
                <TabsTrigger value="items" className="flex items-center gap-1.5">
                  <IconList className="size-3.5" />
                  Items
                </TabsTrigger>
                <TabsTrigger value="client" className="flex items-center gap-1.5">
                  <IconUser className="size-3.5" />
                  Détail client
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-1.5">
                  <IconHistory className="size-3.5" />
                  Historique
                </TabsTrigger>
                <TabsTrigger value="raw" className="flex items-center gap-1.5">
                  <IconCode className="size-3.5" />
                  API brute
                </TabsTrigger>
              </TabsList>

              <TabsContent value="problems"><ProblemsTab /></TabsContent>
              <TabsContent value="hosts"><HostsTab /></TabsContent>
              <TabsContent value="items"><ItemsTab /></TabsContent>
              <TabsContent value="client"><ClientDetailTab /></TabsContent>
              <TabsContent value="history"><ProblemHistoryTab /></TabsContent>
              <TabsContent value="raw"><RawApiTab /></TabsContent>
            </Tabs>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}