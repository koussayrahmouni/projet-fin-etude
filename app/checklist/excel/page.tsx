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
import { Check, ChevronsUpDown, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────
type SheetRow = (string | number | boolean | null)[];
type SheetData = {
  sheetName: string;
  headers: string[];
  rows: SheetRow[];
};

type AwxClient = {
  id: number;
  hostName: string;
  clientName: string;
};

// ─── Same fetch helper as ChecklistPage ─────────────────────────────────────
const apiFetch = (url: string, options: RequestInit = {}) =>
  fetch(url, { credentials: "include", ...options });

// ─── Combobox ────────────────────────────────────────────────────────────────
function ClientCombobox({
  value,
  onChange,
  clients,
  loading,
}: {
  value: string;
  onChange: (value: string) => void;
  clients: AwxClient[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filtered = clients.filter((c) =>
    c.clientName.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-left font-normal h-10"
          disabled={loading}
        >
          <span className={cn("truncate", !value && "text-slate-400")}>
            {value || (loading ? "Loading clients..." : "Select or type a client...")}
          </span>
          {loading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type client name..."
            value={inputValue}
            onValueChange={(v) => {
              setInputValue(v);
              onChange(v);
            }}
          />
          <CommandList>
            {filtered.length === 0 && inputValue.length > 0 ? (
              <CommandEmpty
                className="py-3 px-4 text-sm text-slate-500 cursor-pointer hover:bg-slate-50"
                onClick={() => {
                  onChange(inputValue);
                  setOpen(false);
                }}
              >
                Use &ldquo;{inputValue}&rdquo;
              </CommandEmpty>
            ) : filtered.length === 0 ? (
              <CommandEmpty>No clients found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.clientName}
                    onSelect={() => {
                      onChange(client.clientName);
                      setInputValue(client.clientName);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 flex-shrink-0",
                        value === client.clientName ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{client.clientName}</span>
                      <span className="text-xs text-slate-400">{client.hostName}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ChecklistExcelPage() {
  const [clientNameInput, setClientNameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [selectedSheet, setSelectedSheet] = useState(0);

  // Same AWX client type as ChecklistPage
  const [awxClients, setAwxClients] = useState<AwxClient[]>([]);

  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [tempValue, setTempValue] = useState("");
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // ─── Fetch clients from /api/checklist/clients (same as ChecklistPage) ──
  useEffect(() => {
    setClientsLoading(true);
    apiFetch("/api/checklist/clients")
      .then((res) => res.json())
      .then((clients: AwxClient[]) => {
        setAwxClients(clients);
      })
      .catch((err) => {
        console.error("Failed to load AWX clients:", err);
        setAwxClients([]);
      })
      .finally(() => setClientsLoading(false));
  }, []);

  // ─── Load Excel ────────────────────────────────────────────────────────
  async function loadExcel() {
    if (!clientNameInput.trim()) return;
    setLoading(true);
    setError(null);
    setSheets([]);
    setChecklistId(null);

    try {
      const res = await apiFetch(
        `/api/checklist/excel?clientName=${encodeURIComponent(clientNameInput.trim())}`
      );
      if (res.status === 404) {
        setError("No checklist with Excel data found for this client.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load");

      const data = await res.json();
      setChecklistId(data.id);
      setClientName(data.clientName);

      const binary = atob(data.excelData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const workbook = XLSX.read(bytes, { type: "array" });

      const parsed: SheetData[] = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
          header: 1,
          defval: "",
          blankrows: true,
        });
        const headers =
          rows.length > 0
            ? rows[0].map((h: any, i: number) => String(h || `Col ${i + 1}`))
            : [];
        return { sheetName: name, headers, rows: rows.slice(1) };
      });

      setSheets(parsed);
      setSelectedSheet(0);
    } catch {
      setError("Failed to load Excel data. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Save to DB ────────────────────────────────────────────────────────
  const saveToDb = useCallback(
    async (updatedSheets: SheetData[]) => {
      if (!checklistId) return;
      setSaving(true);
      try {
        const wb = XLSX.utils.book_new();
        for (const sheet of updatedSheets) {
          const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
          XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
        }
        const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        let binary = "";
        new Uint8Array(wbOut).forEach((b) => (binary += String.fromCharCode(b)));
        await apiFetch("/api/checklist/excel", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: checklistId, excelData: btoa(binary) }),
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch {
        // silent
      } finally {
        setSaving(false);
      }
    },
    [checklistId]
  );

  function autosave(updatedSheets: SheetData[]) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveToDb(updatedSheets), 1000);
  }

  // ─── Cell editing ──────────────────────────────────────────────────────
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

  // ─── Download ──────────────────────────────────────────────────────────
  function handleDownload() {
    if (!sheets.length) return;
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
      const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
      XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
    }
    const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbOut]), `B2R-Checklist-${clientName || "export"}.xlsx`);
  }

  // ─── Row styling ───────────────────────────────────────────────────────
  function isSectionRow(row: SheetRow) {
    const first = String(row[0] || "").trim();
    return /^\d+$/.test(first) && row.filter((c) => String(c || "").trim()).length <= 4;
  }

  function isHeaderRow(row: SheetRow) {
    const text = row.map((c) => String(c || "").trim().toUpperCase()).join(" ");
    return text.includes("CHECKLIST") || text.includes("OWNER") || text.includes("STATUS");
  }

  function getCellStatusClass(value: string) {
    const u = value.toUpperCase().trim();
    if (u === "✔" || u === "DONE") return "text-green-700 bg-green-50 font-medium";
    if (u === "✘" || u === "NOT DONE" || u === "NOT STARTED") return "text-red-600 bg-red-50 font-medium";
    if (u.includes("IN PROGRESS") || u.includes("PROGRESS")) return "text-amber-700 bg-amber-50 font-medium";
    if (u === "N/A") return "text-slate-400 italic";
    return "";
  }

  const currentSheet = sheets[selectedSheet];

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4 sticky top-0 z-10">
          <SidebarTrigger className="-ml-1" />
          <div className="h-5 w-px bg-slate-200" />
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          <h1 className="text-base font-semibold tracking-tight text-slate-900">
            Checklist Excel Editor
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {saving && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving...
              </span>
            )}
            {saveSuccess && !saving && (
              <span className="flex items-center gap-1.5 text-xs text-green-600">
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
          </div>
        </header>

        <div className="flex flex-col gap-5 p-5 bg-slate-50 min-h-[calc(100vh-56px)]">
          <div className="max-w-[1600px] mx-auto w-full space-y-5">

            {/* Search card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Load Checklist
              </p>
              <div className="flex gap-3 items-end">
                <div className="flex-1 max-w-sm">
                  <label className="text-xs text-slate-500 font-medium mb-1.5 block">
                    Client Name
                  </label>
                  <ClientCombobox
                    value={clientNameInput}
                    onChange={setClientNameInput}
                    clients={awxClients}
                    loading={clientsLoading}
                  />
                </div>
                <Button
                  onClick={loadExcel}
                  disabled={loading || !clientNameInput.trim()}
                  className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</>
                  ) : (
                    "Load"
                  )}
                </Button>
              </div>

              {/* Client not found in AWX */}
              {!clientsLoading && awxClients.length === 0 && (
                <p className="mt-3 text-xs text-amber-600 flex items-center gap-1.5">
                  ⚠️ No clients loaded from AWX — you can still type a client name manually.
                </p>
              )}

              {error && (
                <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5">
                  <span>⚠️</span> {error}
                </p>
              )}
            </div>

            {/* Loaded content */}
            {currentSheet && (
              <>
                {/* Info / controls bar */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client</span>
                      <span className="text-sm font-semibold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full">
                        {clientName}
                      </span>
                    </div>
                    {sheets.length > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sheet</span>
                        <div className="flex gap-1">
                          {sheets.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => { setSelectedSheet(i); setEditingCell(null); }}
                              className={cn(
                                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                                selectedSheet === i
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              )}
                            >
                              {s.sheetName}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download .xlsx
                  </button>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b-2 border-slate-200">
                          <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-10 text-center border-r border-slate-200 sticky left-0 bg-slate-50">
                            #
                          </th>
                          {currentSheet.headers.map((h, i) => (
                            <th
                              key={i}
                              className="px-3 py-2.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-r border-slate-200 min-w-[120px] whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentSheet.rows.map((row, ri) => {
                          const isSection = isSectionRow(row);
                          const isHeader = isHeaderRow(row);
                          return (
                            <tr
                              key={ri}
                              className={cn(
                                "border-b border-slate-100 transition-colors",
                                isSection ? "bg-orange-50 border-b border-orange-200" :
                                  isHeader ? "bg-amber-50" :
                                    "hover:bg-blue-50/40"
                              )}
                            >
                              <td className="px-3 py-2 text-[10px] text-slate-300 text-center border-r border-slate-100 font-mono sticky left-0 bg-inherit">
                                {ri + 1}
                              </td>
                              {currentSheet.headers.map((_, ci) => {
                                const cellValue = row[ci] != null ? String(row[ci]) : "";
                                const isEditing = editingCell?.row === ri && editingCell?.col === ci;
                                const statusClass = getCellStatusClass(cellValue);

                                return (
                                  <td
                                    key={ci}
                                    className={cn(
                                      "px-3 py-2 border-r border-slate-100 whitespace-nowrap max-w-[300px] truncate",
                                      isSection && "font-bold text-slate-700",
                                      statusClass
                                    )}
                                    onDoubleClick={() => startEdit(ri, ci)}
                                    title={cellValue}
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
                                        className="w-full min-w-[120px] px-2 py-0.5 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
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
                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-400">
                      {currentSheet.rows.length} rows · Double-click any cell to edit · Changes are autosaved
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Empty state */}
            {!loading && sheets.length === 0 && !error && (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-20 text-center">
                <div className="text-5xl mb-4">📊</div>
                <p className="text-lg font-semibold text-slate-700">No checklist loaded</p>
                <p className="text-sm text-slate-400 mt-1">
                  Select a client above and click <strong>Load</strong>
                </p>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="bg-white border border-slate-200 rounded-xl p-20 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Loading checklist...</p>
              </div>
            )}

          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}