"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import { v4 as uuid } from "uuid";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

type ExcelData = {
  sheetName: string;
  headers: string[];
  rows: any[][];
  rawData: any[];
}[];

const PAGE_SIZE = 100;
const TEAMS = ["Delivery", "IDKA", "NSS Operations"];

export default function ExcelPage() {
  const [excelData, setExcelData] = useState<ExcelData>([]);
  const [editedGroups, setEditedGroups] = useState<any[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<number>(0);
  const [fileName, setFileName] = useState<string>("");
  const [viewMode, setViewMode] = useState<"checklist-table" | "raw">("checklist-table");
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Editing state
  const [editingCell, setEditingCell] = useState<{
    type: "sectionName" | "itemName" | "description" | "comment" | "status";
    gid: number;
    iid?: number;
    teamIdx?: number;
  } | null>(null);
  const [tempValue, setTempValue] = useState<string>("");

  const resizingRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);
  const saveTimeout = useRef<any>(null);
  const sessionIdRef = useRef<string | null>(null);

  const viewModeButtonClass = (mode: string) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      viewMode === mode
        ? "bg-blue-600 text-white"
        : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
    }`;

  // ─── Session & Autosave ────────────────────────────────────────────────
  function getSessionId() {
    if (typeof window === "undefined") return null;
    let id = localStorage.getItem("excel_session_id");
    if (!id) {
      id = uuid();
      localStorage.setItem("excel_session_id", id);
    }
    return id;
  }

  function autosave(data: any, filename?: string) {
    if (!sessionIdRef.current) return;

    clearTimeout(saveTimeout.current);

    saveTimeout.current = setTimeout(() => {
      fetch("/api/excel/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          filename: filename || fileName || "unnamed.xlsx",
          data,
        }),
      }).catch((err) => console.error("Autosave failed:", err));
    }, 800);
  }

  function onExcelChange(newExcelData: ExcelData) {
    setExcelData(newExcelData);
    autosave({ excelData: newExcelData, editedGroups }, fileName);
  }

  // Load saved session on mount
  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId) return;
    sessionIdRef.current = sessionId;

    fetch(`/api/excel/load?sessionId=${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Load failed");
        return res.json();
      })
      .then((saved) => {
        if (saved?.data) {
          if (saved.data.excelData) setExcelData(saved.data.excelData);
          if (saved.data.editedGroups) setEditedGroups(saved.data.editedGroups);
          if (saved.data.fileName) setFileName(saved.data.fileName);
          if (saved.data.viewMode) setViewMode(saved.data.viewMode);
        }
      })
      .catch((err) => console.error("Failed to load session:", err));
  }, []);

  // ─── File handling & parsing ───────────────────────────────────────────
  const handleFile = async (file: File) => {
    setFileName(file.name);
    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      workbook.SheetNames.forEach((sheetName) => {
        const ws = workbook.Sheets[sheetName];
        if (ws["!merges"]) {
          ws["!merges"].forEach((merge) => {
            const startAddr = XLSX.utils.encode_cell(merge.s);
            const startCell = ws[startAddr];
            if (startCell && startCell.v !== undefined) {
              const value = startCell.v;
              for (let R = merge.s.r; R <= merge.e.r; ++R) {
                for (let C = merge.s.c; C <= merge.e.c; ++C) {
                  const addr = XLSX.utils.encode_cell({ r: R, c: C });
                  if (!ws[addr]) ws[addr] = {};
                  ws[addr].v = value;
                  ws[addr].t = startCell.t || "s";
                }
              }
            }
          });
        }
      });

      const allSheets: ExcelData = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
          header: 1,
          defval: "",
          blankrows: true,
        });
        const rawData = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
          blankrows: true,
        });
        const headers = rows.length > 0 ? rows[0].map((h, i) => h || `Col ${i + 1}`) : [];
        const dataRows = rows.slice(1);
        return {
          sheetName,
          headers,
          rows: dataRows,
          rawData,
        };
      });

      setExcelData(allSheets);
      onExcelChange(allSheets);

      setSelectedSheet(0);
      setColumnWidths({});
      setCurrentPage(1);
      setSearchTerm("");

      if (allSheets.length > 0) {
        const currentSheet = allSheets[0];
        const rows = currentSheet.rows || [];

        const groups: any[] = [];
        let currentGroup: any = null;
        let currentItem: any = null;
        let groupIdCounter = 0;
        let itemIdCounter = 0;

        for (const row of rows) {
          if (row.every((c: any) => !c || String(c).trim() === "")) continue;

          const col1 = String(row[0] || "").trim();
          const col2 = String(row[1] || "").trim();
          const col3 = String(row[2] || "").trim();

          if (col1 === "" && /^\d+$/.test(col2) && !col2.includes(".") && col3) {
            if (currentItem) currentGroup?.items.push(currentItem);
            if (currentGroup) groups.push(currentGroup);

            const progressIndices: number[] = [];
            row.forEach((cell: any, idx: number) => {
              if (typeof cell === "number") progressIndices.push(idx);
            });

            currentGroup = {
              gid: groupIdCounter++,
              number: col2,
              name: col3,
              progressIndices,
              items: [],
            };
            currentItem = null;
          } else if (currentGroup) {
            const isNewSub = col2 && col2.includes(".");
            const isContinuation = !isNewSub && currentItem;

            if (isNewSub) {
              if (currentItem) currentGroup.items.push(currentItem);

              const itemName = [col2, col3].map(s => String(s || "").trim()).filter(Boolean).join(" ");

              const descStart = 3;
              const descEnd = currentGroup.progressIndices[0] ?? row.length;
              const descCandidates = row.slice(descStart, descEnd)
                .map(c => String(c || "").trim())
                .filter(Boolean);

              let description = "";
              if (descCandidates.length > 0) {
                description = descCandidates.reduce((max, curr) => 
                  curr.length > max.length ? curr : max, descCandidates[0]
                );
              }

              if (description && (description === col3.trim() || itemName.includes(description))) {
                description = "";
              }

              currentItem = {
                iid: itemIdCounter++,
                name: itemName,
                description: description || null,
                teamData: [],
              };
            }

            if (currentItem) {
              currentGroup.progressIndices.forEach((idx: number, tIdx: number) => {
                const statusVal = row[idx];

                let baseStatus = "";
                let percentNum = 0;
                if (typeof statusVal === "number") {
                  percentNum = Math.round(statusVal * 100);
                  if (statusVal === 1) baseStatus = "Done";
                  else if (statusVal === 0) baseStatus = "Not Done";
                  else baseStatus = "In Progress";
                } else if (statusVal != null) {
                  baseStatus = String(statusVal);
                }

                const fullStatus =
                  baseStatus === "Done" || baseStatus === "Not Done"
                    ? `${baseStatus} (${percentNum}%)`
                    : `${percentNum}% (In Progress)`;

                const commentCells = row.slice(idx + 1);
                const comment = commentCells.find((c: any) => c != null && String(c).trim() !== "") || "";
                const commentStr = String(comment).trim();

                if (fullStatus || commentStr) {
                  const existing = currentItem.teamData.find((t: any) => t.team === TEAMS[tIdx]);
                  if (existing) {
                    if (fullStatus) existing.status = fullStatus;
                    if (commentStr) existing.comment = commentStr;
                  } else {
                    currentItem.teamData.push({
                      team: TEAMS[tIdx],
                      status: fullStatus,
                      comment: commentStr || null,
                    });
                  }
                }
              });

              if (isContinuation) {
                const descStart = 3;
                const descEnd = currentGroup.progressIndices[0] ?? row.length;
                const descCandidates = row.slice(descStart, descEnd)
                  .map(c => String(c || "").trim())
                  .filter(Boolean);

                if (descCandidates.length > 0) {
                  const newDesc = descCandidates.reduce((max, curr) => 
                    curr.length > max.length ? curr : max, descCandidates[0]
                  );
                  if (newDesc.length > (currentItem.description || "").length) {
                    currentItem.description = newDesc;
                  }
                }
              }
            }
          }
        }

        if (currentItem) currentGroup?.items.push(currentItem);
        if (currentGroup) groups.push(currentGroup);

        setEditedGroups(groups);
        setViewMode(groups.length > 0 ? "checklist-table" : "raw");
        autosave({ excelData: allSheets, editedGroups: groups }, file.name);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to parse the file. Please ensure it's a valid .xlsx, .xls, or .csv file.");
      setFileName("");
    } finally {
      setLoading(false);
    }
  };

  const currentSheet = excelData[selectedSheet];

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return editedGroups;

    const lower = searchTerm.toLowerCase();

    return editedGroups
      .map(group => ({
        ...group,
        items: group.items.filter((item: any) => 
          item.name.toLowerCase().includes(lower) ||
          (item.description && item.description.toLowerCase().includes(lower)) ||
          item.teamData.some((t: any) => 
            t.status.toLowerCase().includes(lower) || 
            (t.comment && t.comment.toLowerCase().includes(lower))
          )
        ),
      }))
      .filter(group => group.items.length > 0);
  }, [editedGroups, searchTerm]);

  const groupsToRender = searchTerm ? filteredGroups : editedGroups;

  const tableRows = useMemo(() => {
    const rows: { type: "section" | "item"; group: any; item?: any }[] = [];

    groupsToRender.forEach((group) => {
      rows.push({ type: "section", group });

      group.items.forEach((item: any) => {
        rows.push({ type: "item", group, item });
      });
    });

    return rows;
  }, [groupsToRender]);

  const displayedTableRows = tableRows;

  const paginatedTableRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return displayedTableRows.slice(start, start + PAGE_SIZE);
  }, [displayedTableRows, currentPage]);

  const totalTablePages = Math.ceil(displayedTableRows.length / PAGE_SIZE) || 1;

  const visibleRowsCount = displayedTableRows.length;

  const tableColumns = [
    "Item",
    "Description",
    `${TEAMS[0]} Status`,
    `${TEAMS[0]} Comment`,
    `${TEAMS[1]} Status`,
    `${TEAMS[1]} Comment`,
    `${TEAMS[2]} Status`,
    `${TEAMS[2]} Comment`,
  ];

  const startEditing = (
    type: "sectionName" | "itemName" | "description" | "comment" | "status",
    gid: number,
    iid?: number,
    teamIdx?: number,
    currentValue: string = ""
  ) => {
    setEditingCell({ type, gid, iid, teamIdx });
    setTempValue(currentValue);
  };

  const saveEditing = () => {
    if (!editingCell) return;

    setEditedGroups((prev) => {
      const newGroups = prev.map((group) => {
        if (group.gid !== editingCell.gid) return group;

        const newGroup = { ...group };

        if (editingCell.type === "sectionName") {
          newGroup.name = tempValue;
        } else if (
          editingCell.type === "itemName" ||
          editingCell.type === "description" ||
          editingCell.type === "comment" ||
          editingCell.type === "status"
        ) {
          newGroup.items = newGroup.items.map((item: any) => {
            if (item.iid !== editingCell.iid) return item;

            const newItem = { ...item };

            if (editingCell.type === "itemName") {
              newItem.name = tempValue;
            } else if (editingCell.type === "description") {
              newItem.description = tempValue || null;
            } else if (editingCell.type === "comment" && editingCell.teamIdx !== undefined) {
              newItem.teamData = newItem.teamData.map((t: any) =>
                t.team === TEAMS[editingCell.teamIdx!] ? { ...t, comment: tempValue || null } : t
              );
            } else if (editingCell.type === "status" && editingCell.teamIdx !== undefined) {
              newItem.teamData = newItem.teamData.map((t: any) =>
                t.team === TEAMS[editingCell.teamIdx!] ? { ...t, status: tempValue || "" } : t
              );
            }

            return newItem;
          });
        }

        return newGroup;
      });

      autosave({ excelData, editedGroups: newGroups }, fileName);
      return newGroups;
    });

    setEditingCell(null);
    setTempValue("");
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setTempValue("");
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    const data: any[][] = [tableColumns];

    const merges: any[] = [];

    let rowIndex = 1;

    editedGroups.forEach(group => {
      data.push([`${group.number}. ${group.name}`, "", "", "", "", "", "", ""]);
      merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 7 } });
      rowIndex++;

      group.items.forEach((item: any) => {
        const row = [item.name, item.description || ""];

        TEAMS.forEach(team => {
          const t = item.teamData.find((td: any) => td.team === team) || { status: "", comment: "" };
          row.push(t.status || "");
          row.push(t.comment || "");
        });

        data.push(row);
        rowIndex++;
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!merges"] = merges;

    ws["!cols"] = [
      { wch: 30 },
      { wch: 50 },
      { wch: 20 },
      { wch: 30 },
      { wch: 20 },
      { wch: 30 },
      { wch: 20 },
      { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Edited Checklist");
    XLSX.writeFile(wb, `edited-${fileName || "checklist"}.xlsx`);
  };

  const startResizing = useCallback((index: number, startX: number, currentWidth: number) => {
    resizingRef.current = { index, startX, startWidth: currentWidth };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { index, startX, startWidth } = resizingRef.current;
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(50, startWidth + deltaX);
    setColumnWidths(prev => ({ ...prev, [index]: newWidth }));
  }, []);

  const stopResizing = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    if (excelData.length === 0) return;
    setColumnWidths({});
    setCurrentPage(1);
  }, [selectedSheet, excelData.length]);

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Excel Checklist Parser</h1>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-slate-50/40 min-h-screen">
          <div className="max-w-[1600px] mx-auto w-full space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-300 rounded-2xl p-6 text-red-800">
                <p className="font-semibold">Error</p>
                <p className="mt-2">{error}</p>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Excel Checklist Editor</h1>
                <p className="text-slate-500 text-sm mt-1">
                  {loading
                    ? `Parsing ${fileName}...`
                    : fileName
                    ? `Editing: ${fileName}`
                    : "Upload an Excel file to start"}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                    className="hidden"
                    id="file-upload-header"
                    disabled={loading}
                  />
                  <label
                    htmlFor="file-upload-header"
                    className={`px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer text-sm font-medium transition-colors inline-block ${
                      loading ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {loading ? "Parsing..." : fileName ? "Change File" : "Upload File"}
                  </label>
                </div>

                {excelData.length > 0 && (
                  <>
                    <div className="flex gap-2 bg-slate-50 p-1 rounded-lg">
                      <button
                        onClick={() => setViewMode("checklist-table")}
                        className={viewModeButtonClass("checklist-table")}
                        disabled={editedGroups.length === 0}
                      >
                        Checklist Table
                      </button>
                      <button onClick={() => setViewMode("raw")} className={viewModeButtonClass("raw")}>
                        Raw JSON
                      </button>
                    </div>
                    {viewMode === "checklist-table" && editedGroups.length > 0 && (
                      <button
                        onClick={handleExport}
                        className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                      >
                        Download Edited Excel
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {excelData.length === 0 && !loading && (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
                className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-20 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
              >
                <div className="max-w-xs mx-auto">
                  <div className="text-6xl mb-6 group-hover:scale-110 transition-transform">📄</div>
                  <p className="text-xl font-semibold text-slate-800">Ready to parse Excel</p>
                  <p className="text-slate-500 mt-2">Drag and drop your file here or click to browse</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-20 text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
                <p className="mt-6 text-lg font-medium text-slate-700">Parsing your file...</p>
                <p className="text-sm text-slate-500 mt-2">This may take a moment for large files</p>
              </div>
            )}

            {excelData.length > 0 && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Active Sheet
                      </label>
                      <select
                        value={selectedSheet}
                        onChange={(e) => setSelectedSheet(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        {excelData.map((sheet, idx) => (
                          <option key={idx} value={idx}>
                            {sheet.sheetName} ({sheet.rows.length} rows)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-center space-y-6">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Visible Rows
                        </span>
                      </div>
                      <span className="text-2xl font-bold text-green-600 leading-none">
                        {visibleRowsCount}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  {viewMode !== "raw" && (
                    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50">
                      <div className="flex-1 max-w-lg">
                        <input
                          type="text"
                          placeholder="Search in all checklist fields..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {viewMode === "checklist-table" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b-2 border-slate-300 sticky top-0 z-20">
                          <tr>
                            {tableColumns.map((colName, idx) => (
                              <th
                                key={idx}
                                style={{ width: columnWidths[idx] ?? (idx === 1 ? 400 : 200) }}
                                className="relative px-6 py-4 text-[10px] font-bold text-slate-600 uppercase tracking-wider bg-slate-50 border-r border-slate-300 last:border-r-0"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="truncate">{colName}</span>
                                </div>
                                <div
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    startResizing(idx, e.clientX, columnWidths[idx] ?? (idx === 1 ? 400 : 200));
                                  }}
                                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 hover:w-1.5 transition-all z-20"
                                />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300">
                          {paginatedTableRows.length > 0 ? (
                            paginatedTableRows.map((rowObj, rowIdx) => {
                              if (rowObj.type === "section") {
                                const group = rowObj.group;
                                const isEditingName = editingCell?.type === "sectionName" && editingCell.gid === group.gid;

                                return (
                                  <tr key={`section-${group.gid}`} className="bg-blue-50 font-bold">
                                    <td colSpan={tableColumns.length} className="px-6 py-4 text-lg text-slate-900 border-b-2 border-slate-400">
                                      <div className="flex items-center gap-2">
                                        <span>{group.number}.</span>
                                        {isEditingName ? (
                                          <input
                                            autoFocus
                                            value={tempValue}
                                            onChange={(e) => setTempValue(e.target.value)}
                                            onBlur={saveEditing}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") saveEditing();
                                              if (e.key === "Escape") cancelEditing();
                                            }}
                                            className="px-2 py-1 border border-blue-500 rounded bg-white"
                                          />
                                        ) : (
                                          <span
                                            onDoubleClick={() => startEditing("sectionName", group.gid, undefined, undefined, group.name)}
                                            className="cursor-pointer hover:bg-yellow-100 px-1 rounded"
                                          >
                                            {group.name || "(no name)"}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }

                              const group = rowObj.group;
                              const item = rowObj.item;

                              const cells: JSX.Element[] = [];

                              // Item name
                              const isEditingName = editingCell?.type === "itemName" && editingCell.gid === group.gid && editingCell.iid === item.iid;
                              cells.push(
                                <td key="name" className="px-6 py-3 text-sm text-slate-700">
                                  {isEditingName ? (
                                    <input
                                      autoFocus
                                      value={tempValue}
                                      onChange={(e) => setTempValue(e.target.value)}
                                      onBlur={saveEditing}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveEditing();
                                        if (e.key === "Escape") cancelEditing();
                                      }}
                                      className="w-full px-2 py-1 border border-blue-500 rounded bg-white"
                                    />
                                  ) : (
                                    <div
                                      onDoubleClick={() => startEditing("itemName", group.gid, item.iid, undefined, item.name)}
                                      className="cursor-pointer hover:bg-yellow-100 px-1 rounded min-h-[1.5em]"
                                    >
                                      {item.name || "-"}
                                    </div>
                                  )}
                                </td>
                              );

                              // Description
                              const isEditingDesc = editingCell?.type === "description" && editingCell.gid === group.gid && editingCell.iid === item.iid;
                              cells.push(
                                <td key="desc" className="px-6 py-3 text-sm text-slate-700">
                                  {isEditingDesc ? (
                                    <input
                                      autoFocus
                                      value={tempValue}
                                      onChange={(e) => setTempValue(e.target.value)}
                                      onBlur={saveEditing}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveEditing();
                                        if (e.key === "Escape") cancelEditing();
                                      }}
                                      className="w-full px-2 py-1 border border-blue-500 rounded bg-white"
                                    />
                                  ) : (
                                    <div
                                      onDoubleClick={() => startEditing("description", group.gid, item.iid, undefined, item.description || "")}
                                      className="cursor-pointer hover:bg-yellow-100 px-1 rounded min-h-[1.5em]"
                                    >
                                      {item.description || "-"}
                                    </div>
                                  )}
                                </td>
                              );

                              // Teams status + comment
                              TEAMS.forEach((team, teamIdx) => {
                                const t = item.teamData.find((td: any) => td.team === team) || { status: "", comment: "" };

                                const isDone = t.status.includes("Done") && !t.status.includes("Not Done");
                                const isEditingStatus = editingCell?.type === "status" && editingCell.gid === group.gid && editingCell.iid === item.iid && editingCell.teamIdx === teamIdx;

                                cells.push(
                                  <td key={`status-${teamIdx}`} className={`px-6 py-3 text-sm font-medium ${
                                    t.status.includes("Done") && !t.status.includes("Not Done") ? "text-green-600" :
                                    t.status.includes("Not Done") ? "text-red-600" :
                                    "text-blue-600"
                                  }`}>
                                    {isEditingStatus ? (
                                      <input
                                        autoFocus
                                        value={tempValue}
                                        onChange={(e) => setTempValue(e.target.value)}
                                        onBlur={saveEditing}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") saveEditing();
                                          if (e.key === "Escape") cancelEditing();
                                        }}
                                        className="w-full px-2 py-1 border border-blue-500 rounded bg-white"
                                      />
                                    ) : isDone ? (
                                      <div className="px-1 rounded min-h-[1.5em]">
                                        {t.status || "-"}
                                      </div>
                                    ) : (
                                      <div
                                        onDoubleClick={() => startEditing("status", group.gid, item.iid, teamIdx, t.status || "")}
                                        className="cursor-pointer hover:bg-yellow-100 px-1 rounded min-h-[1.5em]"
                                      >
                                        {t.status || "-"}
                                      </div>
                                    )}
                                  </td>
                                );

                                const isEditingComment = editingCell?.type === "comment" && editingCell.gid === group.gid && editingCell.iid === item.iid && editingCell.teamIdx === teamIdx;
                                cells.push(
                                  <td key={`comment-${teamIdx}`} className="px-6 py-3 text-sm text-slate-700">
                                    {isEditingComment ? (
                                      <input
                                        autoFocus
                                        value={tempValue}
                                        onChange={(e) => setTempValue(e.target.value)}
                                        onBlur={saveEditing}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") saveEditing();
                                          if (e.key === "Escape") cancelEditing();
                                        }}
                                        className="w-full px-2 py-1 border border-blue-500 rounded bg-white"
                                      />
                                    ) : (
                                      <div
                                        onDoubleClick={() => startEditing("comment", group.gid, item.iid, teamIdx, t.comment || "")}
                                        className="cursor-pointer hover:bg-yellow-100 px-1 rounded min-h-[1.5em]"
                                      >
                                        {t.comment || "-"}
                                      </div>
                                    )}
                                  </td>
                                );
                              });

                              return (
                                <tr key={`item-${item.iid}`} className="hover:bg-blue-50/30 transition-colors group">
                                  {cells}
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={tableColumns.length} className="py-16 text-center text-slate-500 text-sm">
                                {searchTerm ? "No matching data found." : "No checklist data in this sheet."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {viewMode === "raw" && currentSheet && (
                    <div className="bg-slate-900 p-8">
                      <pre className="text-emerald-400 text-xs font-mono max-h-[70vh] overflow-y-auto">
                        {JSON.stringify(currentSheet.rawData, null, 2)}
                      </pre>
                    </div>
                  )}

                  {viewMode === "checklist-table" && (
                    <div className="border-t border-slate-300 bg-slate-50">
                      <div className="p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-sm text-slate-600">
                          {visibleRowsCount > 0 ? (
                            <>Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, visibleRowsCount)} of {visibleRowsCount} entries</>
                          ) : (
                            "No entries"
                          )}
                        </div>
                        {totalTablePages > 1 && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Previous
                            </button>
                            <span className="px-4 py-2 text-sm font-medium text-slate-700">
                              Page {currentPage} of {totalTablePages}
                            </span>
                            <button
                              onClick={() => setCurrentPage(p => Math.min(totalTablePages, p + 1))}
                              disabled={currentPage === totalTablePages}
                              className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}