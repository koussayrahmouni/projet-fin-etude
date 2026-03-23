"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────
type SheetRow = (string | number | boolean | null)[];
type SheetData = {
  sheetName: string;
  headers: string[];
  rows: SheetRow[];
};

// ─── Combobox Component ─────────────────────────────────────────────────────
function ClientCombobox({
  value,
  onChange,
  clients,
  loading,
}: {
  value: string;
  onChange: (value: string) => void;
  clients: string[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-left font-normal"
          disabled={loading}
        >
          {value || "Select or type a client..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search client..." />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading clients..." : "No clients found."}
            </CommandEmpty>
            <CommandGroup>
              {clients.map((client) => (
                <CommandItem
                  key={client}
                  value={client.toLowerCase()}
                  onSelect={(currentValue) => {
                    const selected = clients.find(
                      (c) => c.toLowerCase() === currentValue
                    ) || currentValue;
                    onChange(selected);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.toLowerCase() === client.toLowerCase()
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {client}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function ChecklistExcelPage() {
  const [clientNameInput, setClientNameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Loaded data
  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [selectedSheet, setSelectedSheet] = useState(0);

  // Available clients from database
  const [clients, setClients] = useState<string[]>([]);

  // Editing state
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [tempValue, setTempValue] = useState("");
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Fetch available client names from database
  useEffect(() => {
    async function fetchClients() {
      setClientsLoading(true);
      try {
        // CHANGE THIS ENDPOINT to match your actual API that returns client names
        // Examples: /api/checklist/clients, /api/checklist?list=clients, etc.
        const res = await fetch("/api/checklist/excel?list=true");

        if (!res.ok) {
          throw new Error("Failed to load client list");
        }

        const data = await res.json();

        // Adapt according to your actual response shape
        let clientList: string[] = [];
        if (Array.isArray(data)) {
          clientList = data;
        } else if (data.clients) {
          clientList = data.clients;
        } else if (data.checklists) {
          clientList = data.checklists;
        } else if (data.names) {
          clientList = data.names;
        }

        setClients(clientList.filter(Boolean));
      } catch (err) {
        console.error("Failed to load client list:", err);
        // User can still type manually even if list fails
      } finally {
        setClientsLoading(false);
      }
    }

    fetchClients();
  }, []);

  // ─── Load Excel from DB ─────────────────────────────────────────────────
  async function loadExcel() {
    if (!clientNameInput.trim()) return;
    setLoading(true);
    setError(null);
    setSheets([]);
    setChecklistId(null);

    try {
      const res = await fetch(`/api/checklist/excel?clientName=${encodeURIComponent(clientNameInput.trim())}`);
      if (res.status === 404) {
        setError("No checklist with Excel data found for this client.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load");

      const data = await res.json();
      setChecklistId(data.id);
      setClientName(data.clientName);

      // Decode base64 → parse with SheetJS
      const binary = atob(data.excelData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const workbook = XLSX.read(bytes, { type: "array" });

      const parsed: SheetData[] = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
          header: 1,
          defval: "",
          blankrows: true,
        });
        const headers = rows.length > 0 ? rows[0].map((h: any, i: number) => String(h || `Col ${i + 1}`)) : [];
        return {
          sheetName: name,
          headers,
          rows: rows.slice(1),
        };
      });

      setSheets(parsed);
      setSelectedSheet(0);
    } catch (err) {
      console.error("Load failed:", err);
      setError("Failed to load Excel data. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Save Excel back to DB ──────────────────────────────────────────────
  const saveToDb = useCallback(async (updatedSheets: SheetData[]) => {
    if (!checklistId) return;
    setSaving(true);

    try {
      const wb = XLSX.utils.book_new();
      for (const sheet of updatedSheets) {
        const allRows = [sheet.headers, ...sheet.rows];
        const ws = XLSX.utils.aoa_to_sheet(allRows);
        XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
      }
      const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });

      const bytes = new Uint8Array(wbOut);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      await fetch("/api/checklist/excel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: checklistId, excelData: base64 }),
      });
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [checklistId]);

  // ─── Autosave with debounce ─────────────────────────────────────────────
  function autosave(updatedSheets: SheetData[]) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveToDb(updatedSheets);
    }, 1000);
  }

  // ─── Cell editing ───────────────────────────────────────────────────────
  function startEdit(row: number, col: number) {
    const value = sheets[selectedSheet]?.rows[row]?.[col];
    setEditingCell({ row, col });
    setTempValue(value != null ? String(value) : "");
  }

  function commitEdit() {
    if (!editingCell) return;
    const { row, col } = editingCell;
    const updated = sheets.map((sheet, si) => {
      if (si !== selectedSheet) return sheet;
      const newRows = sheet.rows.map((r, ri) => {
        if (ri !== row) return r;
        const newRow = [...r];
        while (newRow.length <= col) newRow.push("");
        newRow[col] = tempValue;
        return newRow;
      });
      return { ...sheet, rows: newRows };
    });
    setSheets(updated);
    setEditingCell(null);
    autosave(updated);
  }

  function cancelEdit() {
    setEditingCell(null);
  }

  // ─── Export as .xlsx download ───────────────────────────────────────────
  function handleDownload() {
    if (sheets.length === 0) return;
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
      const allRows = [sheet.headers, ...sheet.rows];
      const ws = XLSX.utils.aoa_to_sheet(allRows);
      XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
    }
    const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbOut]), `B2R-Checklist-${clientName || "export"}.xlsx`);
  }

  // ─── Detect section/header rows for styling ────────────────────────────
  function isSectionRow(row: SheetRow): boolean {
    const firstCell = String(row[0] || "").trim();
    return /^\d+$/.test(firstCell) && row.filter((c) => String(c || "").trim() !== "").length <= 4;
  }

  function isHeaderRow(row: SheetRow): boolean {
    const text = row.map((c) => String(c || "").trim().toUpperCase()).join(" ");
    return text.includes("CHECKLIST") || text.includes("OWNER") || text.includes("STATUS");
  }

  const currentSheet = sheets[selectedSheet];

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Checklist Excel Editor</h1>
          </div>
          {saving && <span className="ml-auto text-xs text-slate-400 animate-pulse">Saving...</span>}
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-slate-50/40 min-h-screen">
          <div className="max-w-[1600px] mx-auto w-full space-y-6">
            {/* Search bar → now Combobox */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Load Checklist Excel</h2>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                    Client Name
                  </label>
                  <ClientCombobox
                    value={clientNameInput}
                    onChange={setClientNameInput}
                    clients={clients}
                    loading={clientsLoading}
                  />
                </div>
                <Button
                  onClick={loadExcel}
                  disabled={loading || !clientNameInput.trim() || clientsLoading}
                  className={cn(
                    "px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    loading && "opacity-70 cursor-wait"
                  )}
                >
                  {loading ? "Loading..." : "Load"}
                </Button>
              </div>
              {error && (
                <p className="mt-3 text-sm text-red-600">{error}</p>
              )}
            </div>

            {/* Loaded content */}
            {currentSheet && (
              <>
                {/* Info bar */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-700">
                      Client: <span className="font-bold text-slate-900">{clientName}</span>
                    </span>
                    {sheets.length > 1 && (
                      <select
                        value={selectedSheet}
                        onChange={(e) => {
                          setSelectedSheet(Number(e.target.value));
                          setEditingCell(null);
                        }}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                      >
                        {sheets.map((s, i) => (
                          <option key={i} value={i}>{s.sheetName}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <button
                    onClick={handleDownload}
                    className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                  >
                    Download .xlsx
                  </button>
                </div>

                {/* Excel table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-amber-50 border-b-2 border-orange-300">
                        <tr>
                          <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-10 text-center border-r border-slate-200">#</th>
                          {currentSheet.headers.map((h, i) => (
                            <th
                              key={i}
                              className="px-3 py-2 text-[10px] font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200 min-w-[100px]"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentSheet.rows.map((row, ri) => {
                          const isSection = isSectionRow(row);
                          const isHeader = isHeaderRow(row);
                          return (
                            <tr
                              key={ri}
                              className={
                                isSection
                                  ? "bg-orange-100 font-bold"
                                  : isHeader
                                  ? "bg-amber-50 font-semibold"
                                  : "hover:bg-blue-50/30"
                              }
                            >
                              <td className="px-2 py-1.5 text-[10px] text-slate-400 text-center border-r border-slate-100 font-mono">
                                {ri + 1}
                              </td>
                              {currentSheet.headers.map((_, ci) => {
                                const cellValue = row[ci] != null ? String(row[ci]) : "";
                                const isEditing = editingCell?.row === ri && editingCell?.col === ci;

                                let statusClass = "";
                                const upper = cellValue.toUpperCase().trim();
                                if (upper === "\u2714" || upper === "DONE") {
                                  statusClass = "text-green-700 bg-green-50";
                                } else if (upper === "\u2718" || upper === "NOT DONE" || upper === "NOT STARTED") {
                                  statusClass = "text-red-700 bg-red-50";
                                } else if (upper.includes("IN PROGRESS") || upper.includes("PROGRESS")) {
                                  statusClass = "text-amber-700 bg-amber-50";
                                } else if (upper === "N/A") {
                                  statusClass = "text-slate-400 bg-slate-50 italic";
                                }

                                return (
                                  <td
                                    key={ci}
                                    className={`px-3 py-1.5 text-sm border-r border-slate-100 ${statusClass}`}
                                    onDoubleClick={() => startEdit(ri, ci)}
                                  >
                                    {isEditing ? (
                                      <input
                                        autoFocus
                                        type="text"
                                        value={tempValue}
                                        onChange={(e) => setTempValue(e.target.value)}
                                        onBlur={commitEdit}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") commitEdit();
                                          if (e.key === "Escape") cancelEdit();
                                        }}
                                        className="w-full px-1 py-0.5 border border-blue-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                                      />
                                    ) : (
                                      <span className="cursor-default">{cellValue}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-xs text-slate-400 text-center">
                  Double-click any cell to edit. Changes are autosaved.
                </p>
              </>
            )}

            {/* Empty state */}
            {!loading && sheets.length === 0 && !error && (
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-20 text-center">
                <div className="max-w-xs mx-auto">
                  <div className="text-6xl mb-6">&#128196;</div>
                  <p className="text-xl font-semibold text-slate-800">No Excel loaded</p>
                  <p className="text-slate-500 mt-2">
                    Select or type a client name above and click Load
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}