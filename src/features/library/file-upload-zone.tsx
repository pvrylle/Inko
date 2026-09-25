"use client";

import { Upload, Plus, AlertCircle } from "lucide-react";
import { useRef, useState } from "react";
import { ACCEPTED_FILE_TYPES_INPUT, type LibraryClass } from "./library-schema";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  classes: LibraryClass[];
  uploadFile: (classId: string, file: File) => Promise<void>;
  uploadError: string | null;
  onCreate?: () => void; // optional callback when user wants to create a new class
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * FileUploadZone renders a class selector, a hidden file input, and an upload
 * button. When no classes exist it prompts the user to create one first.
 *
 * Requirements: 9.1, 9.2, 9.5
 */
export function FileUploadZone({ classes, uploadFile, uploadError, onCreate }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id ?? "");
  const [uploading, setUploading] = useState(false);

  // Keep selectedClassId in sync when the classes list changes (e.g. after
  // creating a new class the parent reloads and passes the updated array).
  // Only reset when the current selection is no longer in the list.
  const isSelectionValid = classes.some((c) => c.id === selectedClassId);
  const effectiveClassId =
    isSelectionValid ? selectedClassId : (classes[0]?.id ?? "");

  const handleClassChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedClassId(event.target.value);
  };

  const handleUploadClick = () => {
    if (!effectiveClassId) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !effectiveClassId) return;

    setUploading(true);
    try {
      await uploadFile(effectiveClassId, file);
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected after an error
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const hasClasses = classes.length > 0;

  return (
    <div className="file-upload-zone">
      {/* ── Upload controls ─────────────────────────────────────────────── */}
      <div className="file-upload-controls">
        {hasClasses ? (
          <>
            {/* Class selector (Req 9.2) */}
            <label className="file-upload-class-label" htmlFor="upload-class-select">
              <span className="sr-only">Select class for upload</span>
              <select
                id="upload-class-select"
                className="file-upload-class-select"
                value={effectiveClassId}
                onChange={handleClassChange}
                disabled={uploading}
                aria-label="Select class"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Hidden file input — accept enforces Req 9.1 */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES_INPUT}
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
              onChange={handleFileChange}
            />

            {/* Upload button */}
            <button
              type="button"
              className="primary-button file-upload-btn"
              onClick={handleUploadClick}
              disabled={uploading || !effectiveClassId}
              aria-busy={uploading}
            >
              <Upload size={16} />
              {uploading ? "Uploading…" : "Upload file"}
            </button>
          </>
        ) : (
          /* No classes yet — prompt to create one first */
          <div className="file-upload-no-class">
            <p className="file-upload-no-class-hint">
              Create a class before uploading files.
            </p>
            {onCreate && (
              <button
                type="button"
                className="secondary-button"
                onClick={onCreate}
              >
                <Plus size={15} />
                New class
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Upload error banner (Req 9.5) ───────────────────────────────── */}
      {uploadError && (
        <div className="file-upload-error" role="alert" aria-live="polite">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
}
