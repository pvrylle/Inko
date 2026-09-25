"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
  listClasses,
  listFiles,
  createClass as repoCreateClass,
  uploadFile as repoUploadFile,
  deleteFile as repoDeleteFile,
} from "./library-repository";
import type { LibraryClass, LibraryFile } from "./library-schema";

// ─── Return type ──────────────────────────────────────────────────────────────

export type UseLibraryReturn = {
  classes: LibraryClass[];
  files: LibraryFile[];
  createClass: (name: string) => Promise<void>;
  uploadFile: (classId: string, file: File) => Promise<void>;
  deleteFile: (file: LibraryFile) => Promise<void>;
  loading: boolean;
  error: string | null;
  uploadError: string | null; // specific error for upload failures (Req 9.5)
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLibrary(): UseLibraryReturn {
  const { userId, isReady } = useAuth();

  const [classes, setClasses] = useState<LibraryClass[]>([]);
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Load classes and files ─────────────────────────────────────────────────

  const reloadClasses = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await listClasses(userId);
      setClasses(data);
    } catch {
      setError("Your classes couldn't be loaded.");
    }
  }, [userId]);

  const reloadFiles = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await listFiles(userId);
      setFiles(data);
    } catch {
      setError("Your files couldn't be loaded.");
    }
  }, [userId]);

  // Mount: load both in parallel
  useEffect(() => {
    if (!isReady || !userId) return;

    Promise.all([listClasses(userId), listFiles(userId)])
      .then(([classesData, filesData]) => {
        setClasses(classesData);
        setFiles(filesData);
        setError(null);
      })
      .catch(() => {
        setError("Your library couldn't be loaded.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isReady, userId]);

  // ── createClass (Req 9.4) ──────────────────────────────────────────────────

  const createClass = useCallback(
    async (name: string) => {
      if (!userId) return;
      await repoCreateClass(userId, name);
      await reloadClasses();
    },
    [userId, reloadClasses],
  );

  // ── uploadFile (Req 9.2, 9.5) ──────────────────────────────────────────────

  const uploadFile = useCallback(
    async (classId: string, file: File) => {
      if (!userId) return;
      setUploadError(null);
      try {
        await repoUploadFile(userId, classId, file);
        await reloadFiles();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : `Failed to upload "${file.name}": unknown error`;
        setUploadError(message);
        throw err; // re-throw so callers can react if needed
      }
    },
    [userId, reloadFiles],
  );

  // ── deleteFile (Req 9.9) ───────────────────────────────────────────────────

  const deleteFile = useCallback(
    async (file: LibraryFile) => {
      if (!userId) return;
      await repoDeleteFile(userId, file);
      await reloadFiles();
    },
    [userId, reloadFiles],
  );

  return {
    classes,
    files,
    createClass,
    uploadFile,
    deleteFile,
    loading,
    error,
    uploadError,
  };
}
