import { create } from "zustand";
import { ZabbixHost } from "@/lib/zabbix";

interface ZabbixState {
  url: string;
  token: string;
  hosts: ZabbixHost[];
  connected: boolean;
  setUrl: (url: string) => void;
  setToken: (token: string) => void;
  setHosts: (hosts: ZabbixHost[]) => void;
  setConnected: (v: boolean) => void;
  disconnect: () => void;
}

export const useZabbixStore = create<ZabbixState>((set) => ({
  url: "",
  token: "",
  hosts: [],
  connected: false,
  setUrl: (url) => set({ url }),
  setToken: (token) => set({ token }),
  setHosts: (hosts) => set({ hosts }),
  setConnected: (connected) => set({ connected }),
  disconnect: () => set({ url: "", token: "", hosts: [], connected: false }),
}));
