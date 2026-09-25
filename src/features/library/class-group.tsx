"use client";

import { useState } from "react";
import { FileText, Trash2, FolderOpen, AlertCircle } from "lucide-react";
import type { LibraryClass, LibraryFile } from "./library-schema";

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

type ConfirmDialogProps = {
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmDialog({ fileName, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="confirm-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="confirm-dialog">
        <span className="confirm-dialog-icon" aria-hidden="true">
          <AlertCircle size={22} />
        </span>
        <h3 id="confirm-dialog-title" className="confirm-dialog-title">Delete file?</h3>
        <p className="confirm-dialog-body">
          <strong>&ldquo;{fileName}&rdquo;</strong> will be permanently removed. This cannot be undone.
        </p>
        <div className="confirm-dialog-actions">
          <button
            className="secondary-button"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="primary-button confirm-danger-button"
            onClick={onConfirm}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FileCard ─────────────────────────────────────────────────────────────────

type FileCardProps = {
  file: LibraryFile;
  className: string;
  onDelete: () => void;
};

function FileCard({ file, className, onDelete }: FileCardProps) {
  const [confirming, setConfirming] = useState(false);

  const formattedDate = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(file.upload_date));

  return (
    <>
      <article className="file-card">
        <div className="file-card-icon" aria-hidden="true">
          <FileText size={18} />
        </div>
        <div className="file-card-body">
          <p className="file-card-name">{file.name}</p>
          <div className="file-card-meta">
            <span className="file-type-badge" data-type={file.type}>
              {file.type.toUpperCase()}
            </span>
            <span className="file-card-date">{formattedDate}</span>
            <span className="file-card-class">{className}</span>
          </div>
        </div>
        <button
          aria-label={`Delete ${file.name}`}
          className="file-card-delete"
          onClick={() => setConfirming(true)}
          type="button"
        >
          <Trash2 size={15} />
        </button>
      </article>

      {confirming && (
        <ConfirmDialog
          fileName={file.name}
          onConfirm={() => {
            setConfirming(false);
            onDelete();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

// ─── ClassGroup ───────────────────────────────────────────────────────────────

type ClassGroupProps = {
  /** The class whose files are being displayed (Req 9.3, 9.8). */
  libraryClass: LibraryClass;
  /** All files belonging to this class (Req 9.3). */
  files: LibraryFile[];
  /** Called when the user confirms deletion of a file (Req 9.9). */
  onDeleteFile: (file: LibraryFile) => void;
};

export function ClassGroup({ libraryClass, files, onDeleteFile }: ClassGroupProps) {
  const fileCount = files.length;

  return (
    <section className="class-group" aria-label={`${libraryClass.name} — ${fileCount} ${fileCount === 1 ? "file" : "files"}`}>
      {/* Header: class name + file count (Req 9.8) */}
      <div className="class-group-header">
        <span className="class-group-icon" aria-hidden="true">
          <FolderOpen size={16} />
        </span>
        <h2 className="class-group-name">{libraryClass.name}</h2>
        {fileCount === 0 ? (
          <span className="class-group-empty-badge">No files yet</span>
        ) : (
          <span className="class-group-count">
            {fileCount} {fileCount === 1 ? "file" : "files"}
          </span>
        )}
      </div>

      {/* Empty indicator when no files (Req 9.8) */}
      {fileCount === 0 ? (
        <p className="class-group-empty-hint">
          No files have been added to this class yet.
        </p>
      ) : (
        /* File list grouped under this class (Req 9.3, 9.10) */
        <ul className="file-list" aria-label={`Files in ${libraryClass.name}`}>
          {files.map((file) => (
            <li key={file.id}>
              <FileCard
                file={file}
                className={libraryClass.name}
                onDelete={() => onDeleteFile(file)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
