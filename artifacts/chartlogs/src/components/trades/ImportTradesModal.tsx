import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListTradesQueryKey } from "@workspace/api-client-react";
import { useAccount } from "@/contexts/AccountContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Upload, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";

// ─── Types (mirrored from generated schemas) ──────────────────────────────────
interface ImportPreviewRow {
  symbol: string;
  type: "long" | "short";
  entryPrice: number;
  exitPrice: number | null;
  positionSize: number;
  openTime: string;
  closeTime: string | null;
  pnl: number | null;
  fees: number | null;
  warning?: string;
}

interface ImportPreviewResponse {
  format: "mt4" | "mt5" | "csv" | "unknown";
  rowCount: number;
  preview: ImportPreviewRow[];
  rawHeaders: string[];
  rawRows: string[][];
}

interface ImportTradesResponse {
  imported: number;
  skipped: number;
  invalidRows: number;
  errors: string[];
  format: string;
}

interface GenericColumnMap {
  symbol: string;
  type: string;
  entryPrice: string;
  exitPrice?: string;
  positionSize?: string;
  openTime: string;
  closeTime?: string;
  pnl?: string;
  fees?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getAuthToken(): string | null {
  return localStorage.getItem("chartlogs_token");
}

async function callPreview(
  file: File,
  accountId?: number,
  columnMap?: GenericColumnMap
): Promise<ImportPreviewResponse> {
  const fd = new FormData();
  fd.append("file", file);
  if (columnMap) fd.append("columnMap", JSON.stringify(columnMap));
  const url = accountId
    ? `/api/trades/import/preview?accountId=${accountId}`
    : `/api/trades/import/preview`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Preview failed");
  return data as ImportPreviewResponse;
}

async function callImport(
  file: File,
  accountId?: number,
  columnMap?: GenericColumnMap
): Promise<ImportTradesResponse> {
  const fd = new FormData();
  fd.append("file", file);
  if (columnMap) fd.append("columnMap", JSON.stringify(columnMap));
  const url = accountId
    ? `/api/trades/import?accountId=${accountId}`
    : `/api/trades/import`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Import failed");
  return data as ImportTradesResponse;
}

const FORMAT_LABELS: Record<string, string> = {
  mt4: "MT4",
  mt5: "MT5",
  csv: "Generic CSV",
  unknown: "Unknown",
};

const FORMAT_COLORS: Record<string, string> = {
  mt4: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  mt5: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  csv: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  unknown: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const REQUIRED_COLS = ["symbol", "type", "entryPrice", "openTime"] as const;
const OPTIONAL_COLS = [
  "exitPrice",
  "positionSize",
  "closeTime",
  "pnl",
  "fees",
] as const;

const COL_LABELS: Record<string, string> = {
  symbol: "Symbol *",
  type: "Direction (buy/sell) *",
  entryPrice: "Entry Price *",
  openTime: "Open Time *",
  exitPrice: "Exit Price",
  positionSize: "Position Size (lots)",
  closeTime: "Close Time",
  pnl: "P&L",
  fees: "Fees",
};

type Step = "upload" | "preview" | "mapping" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportTradesModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const { activeAccountId } = useAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [result, setResult] = useState<ImportTradesResponse | null>(null);
  const [columnMap, setColumnMap] = useState<Partial<GenericColumnMap>>({});

  const reset = () => {
    setStep("upload");
    setFile(null);
    setError(null);
    setPreview(null);
    setResult(null);
    setColumnMap({});
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = useCallback(
    async (f: File) => {
      if (!f.name.endsWith(".csv")) {
        setError("Only .csv files are supported.");
        return;
      }
      setFile(f);
      setError(null);
      setLoading(true);

      try {
        const data = await callPreview(
          f,
          activeAccountId ?? undefined
        );
        setPreview(data);
        setStep(data.format === "unknown" ? "mapping" : "preview");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to parse file");
      } finally {
        setLoading(false);
      }
    },
    [activeAccountId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  // Called from the mapping step: run preview with the column map first
  const handleMappedPreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const map = columnMap as GenericColumnMap;
      const data = await callPreview(file, activeAccountId ?? undefined, map);
      setPreview(data);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  // Called from the preview step: run the actual import
  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const data = await callImport(
        file,
        activeAccountId ?? undefined,
        // Pass columnMap only if the file was a generic CSV that needed mapping
        preview?.format === "csv" ? (columnMap as GenericColumnMap) : undefined
      );
      setResult(data);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const canMappedPreview = REQUIRED_COLS.every((k) => !!columnMap[k]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Trades</DialogTitle>
          <DialogDescription>
            Upload an MT4, MT5, or generic CSV file to import your trade
            history.
          </DialogDescription>
        </DialogHeader>

        {/* ── Step: Upload ── */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-12 flex flex-col items-center gap-4 cursor-pointer transition-colors ${
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/10"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {loading ? (
                <Spinner className="h-10 w-10 text-primary" />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground" />
              )}
              <div className="text-center">
                <p className="font-medium">
                  {loading ? "Parsing file…" : "Drop your CSV here"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  MT4 / MT5 detailed statement CSV · Generic CSV
                </p>
              </div>
              <Button variant="outline" size="sm" type="button" disabled={loading}>
                Browse file
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {error && (
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Supported formats: MT4 detailed statement CSV, MT5 deals CSV,
              generic CSV with column mapping. Max 10 MB.
            </p>
          </div>
        )}

        {/* ── Step: Preview ── */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {file?.name}
                </span>
                <Badge
                  variant="outline"
                  className={`text-xs ${FORMAT_COLORS[preview.format] ?? ""}`}
                >
                  {FORMAT_LABELS[preview.format] ?? preview.format}
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">
                {preview.rowCount} trade{preview.rowCount !== 1 ? "s" : ""}{" "}
                detected
              </span>
            </div>

            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-muted-foreground">
                    <th className="py-2 px-3 text-left font-medium">Symbol</th>
                    <th className="py-2 px-3 text-left font-medium">Dir</th>
                    <th className="py-2 px-3 text-right font-medium">Entry</th>
                    <th className="py-2 px-3 text-right font-medium">Exit</th>
                    <th className="py-2 px-3 text-right font-medium">Size</th>
                    <th className="py-2 px-3 text-right font-medium">P&L</th>
                    <th className="py-2 px-3 text-left font-medium">Open Time</th>
                    <th className="py-2 px-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border/50 last:border-0 ${
                        row.warning
                          ? "bg-amber-500/5 hover:bg-amber-500/10"
                          : "hover:bg-muted/10"
                      }`}
                    >
                      <td className="py-2 px-3 font-bold">{row.symbol}</td>
                      <td className="py-2 px-3">
                        <span
                          className={
                            row.type === "long"
                              ? "text-emerald-400"
                              : "text-red-400"
                          }
                        >
                          {row.type === "long" ? "LONG" : "SHORT"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {row.entryPrice || "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {row.exitPrice ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {row.positionSize || "—"}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-mono ${
                          row.pnl !== null && row.pnl > 0
                            ? "text-emerald-400"
                            : row.pnl !== null && row.pnl < 0
                              ? "text-red-400"
                              : ""
                        }`}
                      >
                        {row.pnl !== null ? row.pnl.toFixed(2) : "—"}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {new Date(row.openTime).getTime() === 0
                          ? "—"
                          : new Date(row.openTime).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3">
                        {row.warning ? (
                          <span
                            className="flex items-center gap-1 text-amber-400 cursor-help"
                            title={row.warning}
                          >
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span className="text-xs truncate max-w-[120px]">
                              {row.warning}
                            </span>
                          </span>
                        ) : (
                          <span className="text-emerald-400 text-xs">✓ OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.rowCount > 20 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing first 20 of {preview.rowCount} rows
              </p>
            )}

            {error && (
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setPreview(null);
                  setError(null);
                }}
              >
                Change file
              </Button>
              <Button
                className="flex-1"
                onClick={handleImport}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Importing…
                  </>
                ) : (
                  `Import ${preview.rowCount} trade${preview.rowCount !== 1 ? "s" : ""}`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Column Mapping ── */}
        {step === "mapping" && preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium truncate max-w-[200px]">
                {file?.name}
              </span>
              <Badge
                variant="outline"
                className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
              >
                Unknown format — map columns
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              We couldn't auto-detect the format. Map your CSV columns to trade
              fields below.
            </p>

            {/* Sample data preview */}
            {preview.rawHeaders.length > 0 && preview.rawRows.length > 0 && (
              <div className="rounded-lg border border-border overflow-x-auto text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-muted-foreground">
                      {preview.rawHeaders.map((h) => (
                        <th
                          key={h}
                          className="py-1.5 px-3 text-left font-medium whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rawRows.slice(0, 3).map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/50 last:border-0"
                      >
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="py-1.5 px-3 text-muted-foreground whitespace-nowrap"
                          >
                            {cell || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Column mapping dropdowns */}
            <div className="grid grid-cols-2 gap-3">
              {([...REQUIRED_COLS, ...OPTIONAL_COLS] as string[]).map((field) => (
                <div key={field} className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {COL_LABELS[field]}
                  </label>
                  <Select
                    value={(columnMap as Record<string, string>)[field] ?? ""}
                    onValueChange={(v) =>
                      setColumnMap((prev) => ({
                        ...prev,
                        [field]: v === "__none__" ? undefined : v,
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select column…" />
                    </SelectTrigger>
                    <SelectContent>
                      {!REQUIRED_COLS.includes(field as typeof REQUIRED_COLS[number]) && (
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">None</span>
                        </SelectItem>
                      )}
                      {preview.rawHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setPreview(null);
                  setError(null);
                  setColumnMap({});
                }}
              >
                Change file
              </Button>
              <Button
                className="flex-1"
                onClick={handleMappedPreview}
                disabled={loading || !canMappedPreview}
              >
                {loading ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Parsing…
                  </>
                ) : (
                  "Preview trades"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Done ── */}
        {step === "done" && result && (
          <div className="space-y-6 py-2">
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <div>
                <p className="text-lg font-semibold">Import complete</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Format detected:{" "}
                  <span className="font-medium text-foreground">
                    {FORMAT_LABELS[result.format] ?? result.format}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">
                  {result.imported}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Imported</p>
              </div>
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold text-yellow-400">
                  {result.skipped}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Duplicates</p>
              </div>
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">
                  {result.invalidRows}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Invalid</p>
              </div>
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold text-red-400">
                  {result.errors.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Errors</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-1 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-400">
                    {e}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  reset();
                }}
              >
                Import another file
              </Button>
              <Button className="flex-1" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
