import { useState, useCallback, useRef } from "react";
import {
  useRequestUploadUrl,
  useFinalizeUpload,
  useDeleteStorageObject,
} from "@workspace/api-client-react";
import { ImageIcon, X, Upload, ZoomIn, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const MAX_FILES = 5;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function getStorageUrl(objectPath: string): string {
  return `/api/storage${objectPath}`;
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

interface ScreenshotUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}

export function ScreenshotUploader({ value, onChange, disabled }: ScreenshotUploaderProps) {
  const requestUploadUrl = useRequestUploadUrl();
  const finalizeUpload = useFinalizeUpload();
  const deleteObject = useDeleteStorageObject();
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Always hold the latest value in a ref so async upload callbacks
  // never close over stale state (fixes concurrent-upload race condition).
  const latestValueRef = useRef<string[]>(value);
  latestValueRef.current = value;

  const uploadFile = useCallback(async (file: File) => {
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setUploading((prev) => [...prev, { id: uid, name: file.name, progress: 10 }]);

    try {
      // Step 1: Request presigned URL from our API
      const { uploadURL, objectPath } = await new Promise<{ uploadURL: string; objectPath: string }>(
        (resolve, reject) => {
          requestUploadUrl.mutate(
            { data: { name: file.name, size: file.size, contentType: file.type } },
            {
              onSuccess: (data) => resolve(data),
              onError: (err) => reject(err),
            }
          );
        }
      );

      setUploading((prev) => prev.map((u) => (u.id === uid ? { ...u, progress: 35 } : u)));

      // Step 2: PUT file directly to GCS via presigned URL
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!putRes.ok) throw new Error("Upload to storage failed");

      setUploading((prev) => prev.map((u) => (u.id === uid ? { ...u, progress: 75 } : u)));

      // Step 3: Finalize — set ownership ACL so only this user can read/delete the object
      await new Promise<void>((resolve, reject) => {
        finalizeUpload.mutate(
          { data: { objectPath } },
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          }
        );
      });

      setUploading((prev) => prev.map((u) => (u.id === uid ? { ...u, progress: 100 } : u)));

      // Use latestValueRef.current (not the closed-over `value`) so that
      // concurrent uploads accumulate correctly even if React hasn't re-rendered yet.
      onChange([...latestValueRef.current, objectPath]);
    } catch {
      setUploading((prev) =>
        prev.map((u) => (u.id === uid ? { ...u, error: "Upload failed" } : u))
      );
    } finally {
      setTimeout(() => {
        setUploading((prev) => prev.filter((u) => u.id !== uid));
      }, 800);
    }
  }, [onChange, requestUploadUrl, finalizeUpload]);

  const handleFiles = useCallback((files: File[]) => {
    setValidationError(null);
    const remaining = MAX_FILES - latestValueRef.current.length - uploading.filter((u) => !u.error).length;
    if (remaining <= 0) {
      setValidationError(`Maximum ${MAX_FILES} screenshots per trade.`);
      return;
    }
    const toUpload = files.slice(0, remaining);
    const errors: string[] = [];
    const valid: File[] = [];

    for (const f of toUpload) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        errors.push(`${f.name}: only JPEG, PNG, WebP accepted`);
      } else if (f.size > MAX_SIZE_BYTES) {
        errors.push(`${f.name}: max size is ${formatBytes(MAX_SIZE_BYTES)}`);
      } else {
        valid.push(f);
      }
    }
    if (errors.length > 0) setValidationError(errors[0]);
    valid.forEach(uploadFile);
  }, [uploading, uploadFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [disabled, handleFiles]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    handleFiles(Array.from(e.target.files));
    e.target.value = "";
  }, [handleFiles]);

  const removeScreenshot = (index: number) => {
    const objectPath = value[index];
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    // Fire-and-forget: delete from GCS (ownership verified server-side via ACL)
    deleteObject.mutate({ data: { objectPath } });
  };

  const canAdd = value.length + uploading.filter((u) => !u.error).length < MAX_FILES && !disabled;

  return (
    <div className="space-y-3">
      {(value.length > 0 || uploading.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {value.map((objectPath, i) => (
            <div key={objectPath} className="relative group w-20 h-20 rounded-md overflow-hidden border border-border">
              <img
                src={getStorageUrl(objectPath)}
                alt={`Screenshot ${i + 1}`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setLightboxIndex(i)}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button
                  type="button"
                  className="text-white hover:text-blue-300"
                  onClick={() => setLightboxIndex(i)}
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                {!disabled && (
                  <button
                    type="button"
                    className="text-white hover:text-red-400"
                    onClick={() => removeScreenshot(i)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {uploading.map((u) => (
            <div
              key={u.id}
              className="relative w-20 h-20 rounded-md border border-border bg-muted/20 flex flex-col items-center justify-center gap-1"
            >
              {u.error ? (
                <X className="h-5 w-5 text-red-400" />
              ) : (
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              )}
              <span className="text-[9px] text-muted-foreground text-center px-1 truncate w-full text-center">
                {u.error ?? `${u.progress}%`}
              </span>
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            dragOver ? "border-primary/60 bg-primary/5" : "border-border hover:border-border/80 hover:bg-muted/10"
          }`}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center">
            <span className="text-foreground font-medium">Click to upload</span> or drag & drop
          </p>
          <p className="text-[10px] text-muted-foreground">JPEG, PNG, WebP · max 10 MB · up to {MAX_FILES} images</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={onInputChange}
          />
        </div>
      )}

      {validationError && (
        <p className="text-xs text-red-400">{validationError}</p>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          urls={value.map(getStorageUrl)}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

interface LightboxProps {
  urls: string[];
  initialIndex: number;
  onClose: () => void;
}

export function Lightbox({ urls, initialIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  const prev = () => setIndex((i) => (i - 1 + urls.length) % urls.length);
  const next = () => setIndex((i) => (i + 1) % urls.length);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      onClick={onClose}
    >
      <div className="relative max-w-5xl max-h-[90vh] px-12" onClick={(e) => e.stopPropagation()}>
        <img
          src={urls[index]}
          alt={`Screenshot ${index + 1}`}
          className="max-h-[85vh] max-w-full object-contain rounded-md"
        />

        <button
          type="button"
          className="absolute top-2 right-2 text-white/70 hover:text-white bg-black/40 rounded-full p-1"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>

        {urls.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-0 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 rounded-full p-1.5"
              onClick={prev}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="absolute right-0 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 rounded-full p-1.5"
              onClick={next}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        <div className="flex justify-center gap-1.5 mt-3">
          {urls.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/30"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
