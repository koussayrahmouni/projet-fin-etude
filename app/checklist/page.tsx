"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { v4 as uuid } from "uuid";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

// ─── Types ─────────────────────────────────────────────────────────────────
type ChecklistItem = {
  id: string;
  name: string;
  description: string;
  owner: string;
  status: "not_started" | "in_progress" | "done" | "na";
  comment: string;
};

type ChecklistSection = {
  number: number;
  name: string;
  items: ChecklistItem[];
};

type ChecklistData = {
  sections: ChecklistSection[];
};

type ClientInfo = {
  offre: string;
  prestation: string;
  infra: string;
  gouvernance: string;
};

type SavedChecklist = {
  id: string;
  clientName: string;
  updatedAt: string;
  progress: number;
  totalItems: number;
  doneItems: number;
};

// ─── Status helpers ────────────────────────────────────────────────────────
const STATUS_OPTIONS: { value: ChecklistItem["status"]; label: string; color: string; bg: string }[] = [
  { value: "not_started", label: "Not Started", color: "text-slate-600", bg: "bg-slate-100 border-slate-300" },
  { value: "in_progress", label: "In Progress", color: "text-blue-700", bg: "bg-blue-50 border-blue-300" },
  { value: "done", label: "Done", color: "text-green-700", bg: "bg-green-50 border-green-300" },
  { value: "na", label: "N/A", color: "text-amber-700", bg: "bg-amber-50 border-amber-300" },
];

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
}

function statusStyle(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
}

// ─── Default B2R Template ──────────────────────────────────────────────────
function createDefaultTemplate(): ChecklistData {
  const tpl = (id: string, name: string, description: string, owner: string): ChecklistItem => ({
    id,
    name,
    description,
    owner,
    status: "not_started",
    comment: "",
  });

  return {
    sections: [
      {
        number: 1,
        name: "JIRA",
        items: [
          tpl("1.1", "Projet JIRA RUN à ouvrir", "Ticket JIRA à ouvrir pour créer le composant sur ESPPRI ou MPSPRI selon le serveur", "CDM"),
          tpl("1.2", "Création du composant JIRA", "Ticket JIRA à ouvrir avec: mise en place du workflow standard, accès à toute l'équipe RUN", "APP DELIVERY"),
          tpl("1.3", "Informer le service desk de la date du B2R", "Ticket JIRA à ouvrir par le build pour qu'ils modifient le workflow et envoient les tickets au RUN", "APP DELIVERY"),
          tpl("1.4", "Clôturer tous les tickets en Build", "", "NSS DELIVERY"),
          tpl("1.5", "Clôturer tous les tickets en Build", "", "NSS ARCHITECTURE"),
        ],
      },
      {
        number: 2,
        name: "DOLLAR UNIVERSE",
        items: [
          tpl("2.1", "Installation Dollar Universe", "Fournir l'emplacement (pour nouveau client, vérifier la mise en place du mode cluster)", "NSS DELIVERY"),
          tpl("2.2", "Création des comptes environnements applicatif", "Un compte par environnement", "NSS DELIVERY"),
          tpl("2.3", "Utilisation d'un /admin dédié ?", "Prendre les sessions de SOS par exemple", "NSS DELIVERY"),
          tpl("2.4", "Sauvegarde des logs $U", "Consigne maia 677", "NSS DELIVERY"),
          tpl("2.5", "Création des uprocs pour l'upgrade dsnval", "Prendre les uprocs de 00 de app007 / app008", "NSS DELIVERY"),
          tpl("2.6", "Mise en place du mécanisme des GO automatique", "Consigne maia 770", "NSS DELIVERY"),
          tpl("2.7", "Utilisation d'un /admin dédié ?", "Faire du ménage sur le /admin dédié pour ne garder que l'utile", "NSS DELIVERY"),
          tpl("2.8", "Mise en place des commentaires automatiques", "Cas d'un serveur dédié et en DP", "NSS DELIVERY"),
          tpl("2.9", "Mise en place d'un stop & start + clean quotidien automatique", "Activer la supervision dans Maia", "NSS DELIVERY"),
          tpl("2.10", "Synchroniser les function_sql_Slice.sh et function.sh entre la horsprod et la prod", "Sur le user admjenkins", "NSS DELIVERY"),
          tpl("2.11", "Synchroniser les objets $U entre PROD et HORS PROD", "Cas où des développements sont faits en PRD par défaut lors du BUILD", "NSS DELIVERY"),
          tpl("2.12", "Gestion des faux KO", "", "NSS DELIVERY"),
        ],
      },
      {
        number: 3,
        name: "PLAN DE PRODUCTION",
        items: [
          tpl("3.1", "Utilisation du plan de production standard", "Dédié ou virtuel, prise des règlements de BdRn, présence de consigné", "NSS DELIVERY"),
          tpl("3.2", "Exécution totale de tout le cycle de paie", "Sans exception il faut tester tout le cycle", "NSS DELIVERY"),
          tpl("3.3", "Configuration d'une session de rafraîchissement et test sur les environnements concernés", "Consigne maia 421", "NSS DELIVERY"),
          tpl("3.4", "Mise en place et test d'une sauvegarde légale", "", "NSS DELIVERY"),
          tpl("3.5", "Mise en place des purges", "Activer les sessions de purges", "NSS DELIVERY"),
          tpl("3.6", "Mise en place des sessions de comptage de bulletins (Jet Prefac)", "Identifier la méthode de comptage avec le projet pour intégration des scripts et alimentation de JetPrefact", "NSS DELIVERY"),
        ],
      },
      {
        number: 4,
        name: "ENVIRONNEMENT APPLICATIF",
        items: [
          tpl("4.1", "Bien étudier les valeurs Xmx des services", "EDSN: 4G par défaut, EVEMED: 4G, M2M-SIMU: 4G, Service query: 10G, Service openhr: 2G, Service 4you: 10G, Tomweb: 6G, Tomtools: 2G, Tombatch: 4G", "APP DELIVERY"),
          tpl("4.2", "Vérification que les ports sont bien fixés", "Tous les services sans exception (ports shutdown karaf et rmi openhr aussi)", "APP DELIVERY"),
          tpl("4.3", "Vérifier que les tomcat sont en dernière version disponible", "", "APP DELIVERY"),
          tpl("4.4", "Vérifier que Java est en dernière version disponible", "", "APP DELIVERY"),
          tpl("4.5", "Ajouter la clé SSH entre l'environnement PRD et APPV55", "", "APP DELIVERY"),
          tpl("4.6", "Autoriser l'accès aux tunisiens sur le serveur", "", "APP DELIVERY"),
        ],
      },
      {
        number: 5,
        name: "MONITORING",
        items: [
          tpl("5.1", "Configurer l'ensemble des serveurs sur MAIA", "CMDB MAIA++", "NSS DELIVERY"),
          tpl("5.2", "Configurer l'ensemble des services HRA sur MAIA", "CMDB MAIA++", "NSS DELIVERY"),
          tpl("5.3", "Configurer l'ensemble des URL sur MAIA", "CMDB MAIA++", "NSS DELIVERY"),
          tpl("5.4", "Activer le job manager", "Activer les services de PS Monitor, Maia la supervision, stitch Maia", "NSS DELIVERY"),
          tpl("5.5", "Activer le zo-monitor", "Configuration de zo-monitor/conf/jdbc.properties", "NSS DELIVERY"),
          tpl("5.6", "Mise en place de zabbix + configuration de chaque environnement", "Tous les services doivent être supervisés dans Zabbix", "NSS ARCHITECTURE"),
          tpl("5.7", "Mise en place indicateurs de performance (Khronos)", "Disposer des indicateurs standard (hra-space/4you) dès les 1ers mois du GO Live", "NSS DELIVERY"),
          tpl("5.8", "Ticket suivi de paie", "Si le ticket de suivi de paie est mis en place pour le client, s'assurer que le client respectera le standard", "NSS DELIVERY"),
          tpl("5.9", "Configuration + activation des alias", "", "NSS DELIVERY"),
        ],
      },
      {
        number: 6,
        name: "LIVRABLES",
        items: [
          tpl("6.1", "Document d'Architecture Technique (DAT)", "", "NSS DELIVERY"),
          tpl("6.2", "Mise à disposition du document Spécifications Techniques", "", "NSS DELIVERY"),
          tpl("6.3", "Matrices de Flux Interne", "", "NSS ARCHITECTURE"),
          tpl("6.4", "Matrices de Flux WAN", "", "NSS ARCHITECTURE"),
          tpl("6.5", "SPEC LB", "Format Outsourcing", "NSS DELIVERY"),
          tpl("6.6", "Mise à disposition du document Spécifications Techniques (Document / consignes Maïa)", "Comptes SFTP + mdp, Liste des serveurs de traitements, Query, BDD, etc.", "NSS DELIVERY"),
          tpl("6.7", "Cahier d'Exploitation", "Le cahier d'exploitation doit reprendre les spécifiques clients (ex: sso, application spécifique, fonctionnement spécifique, etc.)", "APP DELIVERY"),
        ],
      },
      {
        number: 7,
        name: "SYSTÈME & INFRASTRUCTURE",
        items: [
          tpl("7.1", "Activation history processing", "Sauvegarde automatique des commandes exécutées", "NSS DELIVERY"),
          tpl("7.2", "Configuration + activation des alias", "Accès aux comptes clients (Slices)", "NSS DELIVERY"),
          tpl("7.3", "Création des comptes SFTP + partage de clé SSH", "Un compte SFTP par défaut et par environnement", "NSS DELIVERY"),
          tpl("7.4", "Activer les accès UAM pour le RUN", "Sans exception le RUN doit avoir accès aux environnements de chaque client", "NSS DELIVERY"),
          tpl("7.5", "Création FS /admin", "Applicable uniquement si c'est un client dédié", "NSS DELIVERY"),
          tpl("7.6", "Création FS /SauvegardeLegale", "", "NSS DELIVERY"),
          tpl("7.7", "Création FS /Archive", "", "NSS DELIVERY"),
          tpl("7.8", "Cloud control configuré", "", "NSS DELIVERY"),
          tpl("7.9", "PCA", "Faire un test PCA concluant, communiquer la date", "NSS DELIVERY"),
          tpl("7.10", "DRT", "Faire le DRT, communiquer la date", "NSS DELIVERY"),
          tpl("7.11", "Patchs réalisés", "", "NSS DELIVERY"),
          tpl("7.12", "PVE Finalisé", "", "NSS DELIVERY"),
        ],
      },
      {
        number: 8,
        name: "SECURITY",
        items: [
          tpl("8.1", "Agent Trend déployé, configuré et à jour sur tous les serveurs du client", "", "SECURITY"),
          tpl("8.2", "EDR déployé, configuré et à jour sur tous les serveurs du client", "", "SECURITY"),
          tpl("8.3", "Atelier de sécurité réalisé", "", "SECURITY"),
          tpl("8.4", "Serveurs du client intégrés dans le SOC", "", "SECURITY"),
          tpl("8.5", "Solution MFA, déployé, configuré et testé", "", "SECURITY"),
          tpl("8.6", "Pentest réalisé", "", "SECURITY"),
          tpl("8.7", "Plan de remédiation clôturé (les P1 doivent être corrigées)", "", "SECURITY"),
          tpl("8.8", "Atelier de sécurité réalisé", "", "SECURITY"),
          tpl("8.9", "PCA livré au client", "", "SECURITY"),
          tpl("8.10", "PAS de sécurité livré au client", "", "SECURITY"),
          tpl("8.11", "Revue sur les comptes (systèmes et applicatifs)", "", "SECURITY"),
          tpl("8.12", "Preuves sur l'application de la politique de gestion des mots de passe", "", "SECURITY"),
          tpl("8.13", "Droit root retiré pour SHRS", "", "SECURITY"),
          tpl("8.14", "Suppression des comptes Oracle par défaut", "", "SECURITY"),
          tpl("8.15", "Vérification du certificat électronique", "", "SECURITY"),
        ],
      },
    ],
  };
}

// ─── Client info options ───────────────────────────────────────────────────
const OFFRE_OPTIONS = ["Pleiades 4you", "HRAccess Suite9 + HRAccess 4you", "Pleiades E5", "HRAccess Suite9", "HRAccess Suite7"];
const PRESTATION_OPTIONS = ["Hosting Only", "Processing", "Hébergement + Exploitation"];
const INFRA_OPTIONS = ["Dédiée", "Mutualisée", "Semi-dédiée"];
const GOUVERNANCE_OPTIONS = ["DP", "NDP"];

// ─── Component ─────────────────────────────────────────────────────────────
export default function ChecklistPage() {
  // State
  const [checklists, setChecklists] = useState<SavedChecklist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientInfo, setClientInfo] = useState<ClientInfo>({ offre: "", prestation: "", infra: "", gouvernance: "" });
  const [data, setData] = useState<ChecklistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientInfo, setNewClientInfo] = useState<ClientInfo>({ offre: "", prestation: "", infra: "", gouvernance: "" });
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  const saveTimeout = useRef<any>(null);

  // ─── Load checklist list on mount ──────────────────────────────────────
  useEffect(() => {
    loadChecklists();
  }, []);

  async function loadChecklists() {
    try {
      const res = await fetch("/api/checklist/list");
      if (res.ok) {
        const list = await res.json();
        setChecklists(list);
      }
    } catch (err) {
      console.error("Failed to load checklists:", err);
    } finally {
      setLoading(false);
    }
  }

  // ─── Load a specific checklist ─────────────────────────────────────────
  async function loadChecklist(id: string) {
    try {
      setLoading(true);
      const res = await fetch(`/api/checklist/load?id=${id}`);
      if (!res.ok) throw new Error("Load failed");
      const row = await res.json();
      setActiveId(id);
      setClientName(row.client_name);
      setClientInfo(typeof row.client_info === "string" ? JSON.parse(row.client_info) : row.client_info || { offre: "", prestation: "", infra: "", gouvernance: "" });
      setData(typeof row.data === "string" ? JSON.parse(row.data) : row.data);
      setShowNewForm(false);
    } catch (err) {
      console.error("Failed to load checklist:", err);
    } finally {
      setLoading(false);
    }
  }

  // ─── Create new checklist ──────────────────────────────────────────────
  function createChecklist() {
    if (!newClientName.trim()) return;
    const id = uuid();
    const template = createDefaultTemplate();
    setActiveId(id);
    setClientName(newClientName.trim());
    setClientInfo(newClientInfo);
    setData(template);
    setShowNewForm(false);
    setNewClientName("");
    setNewClientInfo({ offre: "", prestation: "", infra: "", gouvernance: "" });

    // Save immediately
    doSave(id, newClientName.trim(), newClientInfo, template);
  }

  // ─── Save (debounced) ─────────────────────────────────────────────────
  function autosave(updatedData: ChecklistData) {
    if (!activeId) return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      doSave(activeId!, clientName, clientInfo, updatedData);
    }, 800);
  }

  async function doSave(id: string, name: string, info: ClientInfo, checklistData: ChecklistData) {
    setSaving(true);
    try {
      await fetch("/api/checklist/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, clientName: name, clientInfo: info, data: checklistData }),
      });
      // Refresh list
      const res = await fetch("/api/checklist/list");
      if (res.ok) setChecklists(await res.json());
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete checklist ─────────────────────────────────────────────────
  async function deleteChecklist(id: string) {
    if (!confirm("Are you sure you want to delete this checklist?")) return;
    try {
      await fetch(`/api/checklist/delete?id=${id}`, { method: "DELETE" });
      if (activeId === id) {
        setActiveId(null);
        setData(null);
        setClientName("");
        setClientInfo({ offre: "", prestation: "", infra: "", gouvernance: "" });
      }
      await loadChecklists();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  // ─── Update item status ───────────────────────────────────────────────
  function updateItem(sectionNumber: number, itemId: string, field: "status" | "comment", value: string) {
    if (!data) return;
    const newData: ChecklistData = {
      sections: data.sections.map((section) => {
        if (section.number !== sectionNumber) return section;
        return {
          ...section,
          items: section.items.map((item) => {
            if (item.id !== itemId) return item;
            return { ...item, [field]: value };
          }),
        };
      }),
    };
    setData(newData);
    autosave(newData);
  }

  // ─── Progress calculation ──────────────────────────────────────────────
  function sectionProgress(section: ChecklistSection) {
    const applicable = section.items.filter((i) => i.status !== "na");
    if (applicable.length === 0) return 100;
    const done = applicable.filter((i) => i.status === "done").length;
    return Math.round((done / applicable.length) * 100);
  }

  const overallProgress = useMemo(() => {
    if (!data) return 0;
    const all = data.sections.flatMap((s) => s.items).filter((i) => i.status !== "na");
    if (all.length === 0) return 0;
    const done = all.filter((i) => i.status === "done").length;
    return Math.round((done / all.length) * 100);
  }, [data]);

  const totalItems = data ? data.sections.flatMap((s) => s.items).filter((i) => i.status !== "na").length : 0;
  const doneItems = data ? data.sections.flatMap((s) => s.items).filter((i) => i.status === "done").length : 0;

  // ─── Toggle section collapse ───────────────────────────────────────────
  function toggleSection(sectionNumber: number) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionNumber)) next.delete(sectionNumber);
      else next.add(sectionNumber);
      return next;
    });
  }

  // ─── Filtered sections ────────────────────────────────────────────────
  const filteredSections = useMemo(() => {
    if (!data) return [];
    if (!searchTerm) return data.sections;
    const lower = searchTerm.toLowerCase();
    return data.sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.name.toLowerCase().includes(lower) ||
            item.description.toLowerCase().includes(lower) ||
            item.owner.toLowerCase().includes(lower) ||
            item.comment.toLowerCase().includes(lower) ||
            statusLabel(item.status).toLowerCase().includes(lower)
        ),
      }))
      .filter((section) => section.items.length > 0 || section.name.toLowerCase().includes(lower));
  }, [data, searchTerm]);

  // ─── Ansible placeholder ────────────────────────────────────────────────
  function handleAnsibleCheck(sectionNumber: number, sectionName: string) {
    alert(`Ansible check for section ${sectionNumber} (${sectionName}) will be available soon.\n\nThis will run automated verification playbooks for the items in this section.`);
  }

  // ─── Excel export (PDF-matching design with ExcelJS) ─────────────────────
  async function handleExport() {
    if (!data) return;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("B2R Checklist");

    // ── Colors matching the PDF ──
    const ORANGE = "F4900C";
    const ORANGE_LIGHT = "F9B233";
    const YELLOW_HEADER = "FFD966";
    const GREEN_FILL = "C6EFCE";
    const GREEN_TEXT = "006100";
    const RED_FILL = "FFC7CE";
    const RED_TEXT = "9C0006";
    const GRAY_BG = "F2F2F2";
    const WHITE = "FFFFFF";
    const BLACK = "000000";

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "FFD0D0D0" } },
      bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
      left: { style: "thin", color: { argb: "FFD0D0D0" } },
      right: { style: "thin", color: { argb: "FFD0D0D0" } },
    };

    const orangeBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "FFF4900C" } },
      bottom: { style: "thin", color: { argb: "FFF4900C" } },
      left: { style: "thin", color: { argb: "FFF4900C" } },
      right: { style: "thin", color: { argb: "FFF4900C" } },
    };

    // ── Column widths ──
    ws.columns = [
      { width: 5 },   // A: ID number
      { width: 38 },  // B: Checklist item name
      { width: 55 },  // C: Description
      { width: 18 },  // D: Owner
      { width: 14 },  // E: Status
      { width: 35 },  // F: Comment
    ];

    let r = 1; // ExcelJS is 1-indexed

    // ════════════════════════════════════════════════════════════════════════
    // ROW 1: Title bar
    // ════════════════════════════════════════════════════════════════════════
    ws.mergeCells(r, 1, r, 6);
    const titleRow = ws.getRow(r);
    titleRow.height = 36;
    const titleCell = ws.getCell(r, 1);
    titleCell.value = "Check List Build-to-Run";
    titleCell.font = { bold: true, size: 16, color: { argb: `FF${WHITE}` } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ORANGE}` } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    for (let c = 1; c <= 6; c++) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ORANGE}` } };
    }
    r++;

    // ════════════════════════════════════════════════════════════════════════
    // ROW 2: Empty spacer
    // ════════════════════════════════════════════════════════════════════════
    ws.getRow(r).height = 8;
    r++;

    // ════════════════════════════════════════════════════════════════════════
    // ROW 3-8: Client info (cols A-C) + Avancement (cols D-F)
    // ════════════════════════════════════════════════════════════════════════

    // -- Client header --
    ws.mergeCells(r, 1, r, 3);
    const clientHeaderCell = ws.getCell(r, 1);
    clientHeaderCell.value = "Client";
    clientHeaderCell.font = { bold: true, size: 11, color: { argb: `FF${WHITE}` } };
    clientHeaderCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ORANGE}` } };
    clientHeaderCell.alignment = { horizontal: "center", vertical: "middle" };
    for (let c = 1; c <= 3; c++) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ORANGE}` } };
      ws.getCell(r, c).border = orangeBorder;
    }

    // -- Avancement header --
    ws.mergeCells(r, 4, r, 6);
    const avancementHeaderCell = ws.getCell(r, 4);
    avancementHeaderCell.value = "Avancement";
    avancementHeaderCell.font = { bold: true, size: 11, color: { argb: `FF${WHITE}` } };
    avancementHeaderCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ORANGE}` } };
    avancementHeaderCell.alignment = { horizontal: "center", vertical: "middle" };
    for (let c = 4; c <= 6; c++) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ORANGE}` } };
      ws.getCell(r, c).border = orangeBorder;
    }
    ws.getRow(r).height = 22;
    r++;

    // -- Client info rows + Avancement rows --
    const clientFields = [
      ["Nom", clientName],
      ["Offre", clientInfo.offre || "—"],
      ["Prestation", clientInfo.prestation || "—"],
      ["Infra", clientInfo.infra || "—"],
      ["Gouvernance", clientInfo.gouvernance || "—"],
    ];

    // Per-owner progress for avancement
    const ownerGroups: Record<string, { done: number; total: number }> = {};
    data.sections.forEach((s) =>
      s.items.forEach((item) => {
        const key = item.owner.includes("APP") ? "APP Delivery"
          : item.owner.includes("ARCHITECTURE") ? "NSS Architecture"
          : item.owner.includes("SECURITY") || item.owner === "SECURITY" ? "Security"
          : "NSS Delivery";
        if (!ownerGroups[key]) ownerGroups[key] = { done: 0, total: 0 };
        if (item.status !== "na") {
          ownerGroups[key].total++;
          if (item.status === "done") ownerGroups[key].done++;
        }
      })
    );
    const avancementRows = Object.entries(ownerGroups).map(([name, { done, total }]) => ({
      name,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
    }));
    avancementRows.push({ name: "Total", pct: overallProgress });

    for (let i = 0; i < Math.max(clientFields.length, avancementRows.length); i++) {
      const row = ws.getRow(r);
      row.height = 18;

      // Client info (cols 1-3)
      if (i < clientFields.length) {
        const labelCell = ws.getCell(r, 1);
        labelCell.value = clientFields[i][0];
        labelCell.font = { bold: true, size: 9, color: { argb: `FF${BLACK}` } };
        labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${GRAY_BG}` } };
        labelCell.border = thinBorder;

        ws.mergeCells(r, 2, r, 3);
        const valCell = ws.getCell(r, 2);
        valCell.value = clientFields[i][1];
        valCell.font = { size: 9 };
        valCell.border = thinBorder;
        ws.getCell(r, 3).border = thinBorder;
      }

      // Avancement (cols 4-6)
      if (i < avancementRows.length) {
        const av = avancementRows[i];
        ws.mergeCells(r, 4, r, 5);
        const avNameCell = ws.getCell(r, 4);
        avNameCell.value = av.name;
        avNameCell.font = { bold: av.name === "Total", size: 9 };
        avNameCell.border = thinBorder;
        avNameCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${GRAY_BG}` } };
        ws.getCell(r, 5).border = thinBorder;

        const avPctCell = ws.getCell(r, 6);
        avPctCell.value = `${av.pct}%`;
        avPctCell.font = { bold: true, size: 9, color: { argb: av.pct === 100 ? `FF${GREEN_TEXT}` : av.pct > 0 ? "FFCC8800" : `FF${RED_TEXT}` } };
        avPctCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: av.pct === 100 ? `FF${GREEN_FILL}` : av.pct > 0 ? "FFFFF2CC" : `FF${RED_FILL}` } };
        avPctCell.alignment = { horizontal: "center" };
        avPctCell.border = thinBorder;
      }
      r++;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Spacer
    // ════════════════════════════════════════════════════════════════════════
    ws.getRow(r).height = 8;
    r++;

    // ════════════════════════════════════════════════════════════════════════
    // "Items checklist" sub-title
    // ════════════════════════════════════════════════════════════════════════
    ws.mergeCells(r, 1, r, 6);
    const itemsTitleCell = ws.getCell(r, 1);
    itemsTitleCell.value = "Items checklist";
    itemsTitleCell.font = { bold: true, size: 12, color: { argb: `FF${WHITE}` } };
    itemsTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ORANGE_LIGHT}` } };
    itemsTitleCell.alignment = { horizontal: "left", vertical: "middle" };
    for (let c = 1; c <= 6; c++) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ORANGE_LIGHT}` } };
    }
    ws.getRow(r).height = 26;
    r++;

    // ════════════════════════════════════════════════════════════════════════
    // Table column headers
    // ════════════════════════════════════════════════════════════════════════
    const headers = ["", "CHECKLIST ITEMS", "Description", "OWNER", "Status", "Commentaire"];
    const headerRow = ws.getRow(r);
    headerRow.height = 24;
    headers.forEach((h, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: `FF${BLACK}` } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${YELLOW_HEADER}` } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "medium", color: { argb: `FF${ORANGE}` } },
        bottom: { style: "medium", color: { argb: `FF${ORANGE}` } },
        left: { style: "thin", color: { argb: "FFD0D0D0" } },
        right: { style: "thin", color: { argb: "FFD0D0D0" } },
      };
    });
    r++;

    // ════════════════════════════════════════════════════════════════════════
    // Section rows + Item rows
    // ════════════════════════════════════════════════════════════════════════
    data.sections.forEach((section) => {
      const prog = sectionProgress(section);

      // -- Section header row (orange bar) --
      const sectionRow = ws.getRow(r);
      sectionRow.height = 24;

      const numCell = ws.getCell(r, 1);
      numCell.value = section.number;
      numCell.font = { bold: true, size: 10, color: { argb: `FF${WHITE}` } };
      numCell.alignment = { horizontal: "center", vertical: "middle" };

      ws.mergeCells(r, 2, r, 4);
      const nameCell = ws.getCell(r, 2);
      nameCell.value = section.name;
      nameCell.font = { bold: true, size: 10, color: { argb: `FF${WHITE}` } };
      nameCell.alignment = { vertical: "middle" };

      const progCell = ws.getCell(r, 5);
      progCell.value = `${prog}%`;
      progCell.font = { bold: true, size: 10, color: { argb: `FF${WHITE}` } };
      progCell.alignment = { horizontal: "center", vertical: "middle" };

      // Fill all cells in section row with orange
      for (let c = 1; c <= 6; c++) {
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ORANGE_LIGHT}` } };
        ws.getCell(r, c).border = {
          top: { style: "thin", color: { argb: `FF${ORANGE}` } },
          bottom: { style: "thin", color: { argb: `FF${ORANGE}` } },
          left: { style: "thin", color: { argb: `FF${ORANGE}` } },
          right: { style: "thin", color: { argb: `FF${ORANGE}` } },
        };
      }
      r++;

      // -- Item rows --
      section.items.forEach((item) => {
        const itemRow = ws.getRow(r);
        itemRow.height = 20;

        // ID
        const idCell = ws.getCell(r, 1);
        idCell.value = item.id;
        idCell.font = { size: 9, color: { argb: "FF666666" } };
        idCell.alignment = { horizontal: "center", vertical: "middle" };
        idCell.border = thinBorder;

        // Item name
        const itemNameCell = ws.getCell(r, 2);
        itemNameCell.value = item.name;
        itemNameCell.font = { size: 9 };
        itemNameCell.alignment = { vertical: "middle", wrapText: true };
        itemNameCell.border = thinBorder;

        // Description
        const descCell = ws.getCell(r, 3);
        descCell.value = item.description || "";
        descCell.font = { size: 8, color: { argb: "FF666666" } };
        descCell.alignment = { vertical: "middle", wrapText: true };
        descCell.border = thinBorder;

        // Owner
        const ownerCell = ws.getCell(r, 4);
        ownerCell.value = item.owner;
        ownerCell.font = { size: 8 };
        ownerCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ownerCell.border = thinBorder;

        // Status — checkmark / X / N/A with colors
        const statusCell = ws.getCell(r, 5);
        if (item.status === "done") {
          statusCell.value = "\u2714";
          statusCell.font = { size: 12, bold: true, color: { argb: `FF${GREEN_TEXT}` } };
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${GREEN_FILL}` } };
        } else if (item.status === "na") {
          statusCell.value = "N/A";
          statusCell.font = { size: 9, italic: true, color: { argb: "FF999999" } };
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${GRAY_BG}` } };
        } else if (item.status === "in_progress") {
          statusCell.value = "In Progress";
          statusCell.font = { size: 9, color: { argb: "FFCC8800" } };
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
        } else {
          statusCell.value = "\u2718";
          statusCell.font = { size: 12, bold: true, color: { argb: `FF${RED_TEXT}` } };
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${RED_FILL}` } };
        }
        statusCell.alignment = { horizontal: "center", vertical: "middle" };
        statusCell.border = thinBorder;

        // Comment
        const commentCell = ws.getCell(r, 6);
        commentCell.value = item.comment || "";
        commentCell.font = { size: 8 };
        commentCell.alignment = { vertical: "middle", wrapText: true };
        commentCell.border = thinBorder;

        r++;
      });
    });

    // ── Write file ──
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `B2R-Checklist-${clientName || "export"}.xlsx`);
  }

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">B2R Checklist</h1>
          </div>
          {saving && <span className="ml-auto text-xs text-slate-400 animate-pulse">Saving...</span>}
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-slate-50/40 min-h-screen">
          <div className="max-w-[1600px] mx-auto w-full space-y-6">
            {/* Top bar: title + actions */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Check List Build-to-Run</h1>
                <p className="text-slate-500 text-sm mt-1">
                  {activeId ? `Client: ${clientName}` : "Select or create a checklist to get started"}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                {/* Client selector */}
                {checklists.length > 0 && (
                  <select
                    value={activeId || ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id) loadChecklist(id);
                    }}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select a checklist...</option>
                    {checklists.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.clientName} ({c.progress}%)
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => setShowNewForm(true)}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                >
                  New Checklist
                </button>
                {activeId && data && (
                  <>
                    <button
                      onClick={handleExport}
                      className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                    >
                      Export Excel
                    </button>
                    <button
                      onClick={() => deleteChecklist(activeId)}
                      className="px-5 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* New checklist form */}
            {showNewForm && (
              <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">New Checklist</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client Name *</label>
                    <input
                      type="text"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="e.g. Nexity"
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Offre</label>
                    <select
                      value={newClientInfo.offre}
                      onChange={(e) => setNewClientInfo({ ...newClientInfo, offre: e.target.value })}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Select...</option>
                      {OFFRE_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prestation</label>
                    <select
                      value={newClientInfo.prestation}
                      onChange={(e) => setNewClientInfo({ ...newClientInfo, prestation: e.target.value })}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Select...</option>
                      {PRESTATION_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Infra</label>
                    <select
                      value={newClientInfo.infra}
                      onChange={(e) => setNewClientInfo({ ...newClientInfo, infra: e.target.value })}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Select...</option>
                      {INFRA_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gouvernance</label>
                    <select
                      value={newClientInfo.gouvernance}
                      onChange={(e) => setNewClientInfo({ ...newClientInfo, gouvernance: e.target.value })}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Select...</option>
                      {GOUVERNANCE_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={createChecklist}
                    disabled={!newClientName.trim()}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Checklist
                  </button>
                  <button
                    onClick={() => setShowNewForm(false)}
                    className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-20 text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
                <p className="mt-6 text-lg font-medium text-slate-700">Loading...</p>
              </div>
            )}

            {/* Empty state */}
            {!loading && !activeId && !showNewForm && (
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-20 text-center">
                <div className="max-w-xs mx-auto">
                  <div className="text-6xl mb-6">&#9745;</div>
                  <p className="text-xl font-semibold text-slate-800">No checklist selected</p>
                  <p className="text-slate-500 mt-2">
                    {checklists.length > 0
                      ? "Select an existing checklist or create a new one"
                      : 'Click "New Checklist" to get started'}
                  </p>
                </div>
              </div>
            )}

            {/* Active checklist */}
            {!loading && activeId && data && (
              <>
                {/* Client info card */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Offre</span>
                        <p className="text-sm font-medium text-slate-700 mt-1">{clientInfo.offre || "—"}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prestation</span>
                        <p className="text-sm font-medium text-slate-700 mt-1">{clientInfo.prestation || "—"}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Infra</span>
                        <p className="text-sm font-medium text-slate-700 mt-1">{clientInfo.infra || "—"}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gouvernance</span>
                        <p className="text-sm font-medium text-slate-700 mt-1">{clientInfo.gouvernance || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Overall progress */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-center">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Progress</span>
                      <span className="text-2xl font-bold text-blue-600 leading-none">{overallProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${overallProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">{doneItems} / {totalItems} items completed</p>
                  </div>
                </div>

                {/* Search */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                  <input
                    type="text"
                    placeholder="Search items, descriptions, owners..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Sections */}
                {filteredSections.map((section) => {
                  const progress = sectionProgress(section);
                  const isCollapsed = collapsedSections.has(section.number);
                  const applicable = section.items.filter((i) => i.status !== "na");
                  const done = applicable.filter((i) => i.status === "done").length;

                  return (
                    <div key={section.number} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      {/* Section header */}
                      <div className="flex items-center bg-slate-50 hover:bg-slate-100 transition-colors">
                        <button
                          onClick={() => toggleSection(section.number)}
                          className="flex-1 px-6 py-4 flex items-center gap-4 text-left"
                        >
                          <span className="text-lg font-bold text-slate-400 w-8">{section.number}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <h3 className="text-base font-semibold text-slate-900 truncate">{section.name}</h3>
                              <span className="text-xs text-slate-500 shrink-0">{done}/{applicable.length} done</span>
                            </div>
                            <div className="mt-1.5 w-full bg-slate-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  progress === 100 ? "bg-green-500" : progress > 0 ? "bg-blue-500" : "bg-slate-300"
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                          <span className={`text-sm font-bold ${progress === 100 ? "text-green-600" : "text-slate-600"}`}>
                            {progress}%
                          </span>
                          <svg
                            className={`w-5 h-5 text-slate-400 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {/* Ansible check button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAnsibleCheck(section.number, section.name);
                          }}
                          className="mr-4 px-3 py-1.5 flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-100 hover:border-orange-300 transition-colors shrink-0"
                          title={`Run Ansible check for ${section.name}`}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
                          </svg>
                          Ansible
                        </button>
                      </div>

                      {/* Section items */}
                      {!isCollapsed && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16">ID</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Item</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Description</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-32">Owner</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-36">Status</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comment</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {section.items.map((item) => {
                                const st = statusStyle(item.status);
                                return (
                                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{item.id}</td>
                                    <td className="px-4 py-3 text-sm text-slate-800 font-medium">{item.name}</td>
                                    <td className="px-4 py-3 text-sm text-slate-500 hidden lg:table-cell max-w-xs">
                                      <span className="line-clamp-2">{item.description || "—"}</span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-600">{item.owner}</td>
                                    <td className="px-4 py-3">
                                      <select
                                        value={item.status}
                                        onChange={(e) => updateItem(section.number, item.id, "status", e.target.value)}
                                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium border ${st.bg} ${st.color} focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer`}
                                      >
                                        {STATUS_OPTIONS.map((opt) => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        type="text"
                                        value={item.comment}
                                        onChange={(e) => updateItem(section.number, item.id, "comment", e.target.value)}
                                        placeholder="Add comment..."
                                        className="w-full px-2.5 py-1.5 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 rounded-md text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Saved checklists grid (when no active checklist) */}
            {!loading && !activeId && !showNewForm && checklists.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Saved Checklists</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {checklists.map((c) => (
                    <div
                      key={c.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => loadChecklist(c.id)}
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{c.clientName}</h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChecklist(c.id);
                          }}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-3 w-full bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${c.progress === 100 ? "bg-green-500" : "bg-blue-500"}`}
                          style={{ width: `${c.progress}%` }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span className="text-xs text-slate-500">{c.doneItems}/{c.totalItems} items</span>
                        <span className={`text-xs font-medium ${c.progress === 100 ? "text-green-600" : "text-blue-600"}`}>{c.progress}%</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        Updated {new Date(c.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
