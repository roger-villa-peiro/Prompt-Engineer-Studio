import { FileItem } from "../types";

/**
 * Opens a directory picker and returns the structure of the directory.
 * Requires modern browser support (Chrome/Edge).
 */
export async function openDirectory(): Promise<FileItem> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error("Your browser does not support the File System Access API.");
  }

  // @ts-expect-error - showDirectoryPicker is a modern API
  const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker();

  return {
    name: handle.name,
    kind: 'directory',
    handle,
    children: await readDirectory(handle)
  };
}

/**
 * Mission 2: Parallelized Directory Reading
 * Recursively reads a directory handle. Uses Promise.all to process entries in parallel
 * instead of sequential 'for await' loops, optimizing I/O for large projects.
 */
async function readDirectory(handle: FileSystemDirectoryHandle): Promise<FileItem[]> {
  const entries: FileSystemHandle[] = [];

  // FileSystemDirectoryHandle values() is valid in modern browsers but missing in old DOM types
  for await (const entry of (handle as any).values()) {
    entries.push(entry as FileSystemHandle);
  }

  const children = await Promise.all(entries.map(async (entry): Promise<FileItem> => {
    const item: FileItem = {
      name: entry.name,
      kind: entry.kind as 'file' | 'directory',
      handle: entry as FileSystemFileHandle | FileSystemDirectoryHandle
    };

    if (entry.kind === 'directory') {
      item.children = await readDirectory(entry as FileSystemDirectoryHandle);
    }

    return item;
  }));

  return children.sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name);
    return a.kind === 'directory' ? -1 : 1;
  });
}

/**
 * Reads text content from a file handle.
 */
export async function readFileContent(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return await file.text();
}
