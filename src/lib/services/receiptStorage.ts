/**
 * Receipt file storage operations using Supabase Storage.
 *
 * Path format: {user_id}/{work_entry_id}/{expense_id}.jpg
 *
 * All functions throw on failure. The caller (workEntryService)
 * is responsible for orchestrating the upload→DB→rollback flow.
 */

import { getSupabase } from "@/lib/supabase/client";

const BUCKET = "receipts";

/** Build the storage path for a receipt. */
export function receiptPath(
  userId: string,
  workEntryId: string,
  expenseId: string,
): string {
  return `${userId}/${workEntryId}/${expenseId}.jpg`;
}

/**
 * Upload a single receipt file to Supabase Storage.
 * @returns the storage path (not a full URL)
 */
export async function uploadReceipt(
  path: string,
  file: File,
): Promise<string> {
  const { error } = await getSupabase()
    .storage
    .from(BUCKET)
    .upload(path, file, { upsert: false });

  if (error) {
    throw new Error(`Receipt upload failed (${path}): ${error.message}`);
  }

  return path;
}

/**
 * Delete one or more receipt files from storage.
 * Throws if any deletion fails.
 */
export async function deleteReceipts(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const { error } = await getSupabase()
    .storage
    .from(BUCKET)
    .remove(paths);

  if (error) {
    throw new Error(`Receipt deletion failed: ${error.message}`);
  }
}

/**
 * Upload multiple receipts. If ANY upload fails, delete all
 * already-uploaded files and throw.
 *
 * @returns array of { expenseId, path } for successfully uploaded files
 */
export async function uploadReceiptsBatch(
  items: { path: string; file: File }[],
): Promise<string[]> {
  const uploaded: string[] = [];

  for (const item of items) {
    try {
      const path = await uploadReceipt(item.path, item.file);
      uploaded.push(path);
    } catch (err) {
      // Rollback already-uploaded files
      if (uploaded.length > 0) {
        try {
          await deleteReceipts(uploaded);
        } catch (rollbackErr) {
          console.error("Rollback of uploaded receipts failed:", rollbackErr);
        }
      }
      throw err;
    }
  }

  return uploaded;
}
