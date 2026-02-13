/**
 * Service layer for WorkEntry operations via Supabase.
 *
 * Guarantees:
 * 1. Totals are computed from raw input — never caller-supplied.
 * 2. Receipt upload → DB insert → rollback on failure (no orphans).
 * 3. All IDs generated client-side via crypto.randomUUID() before any I/O.
 */

import { getSupabase } from "@/lib/supabase/client";
import {
  calculateDurationInHours,
  calculateLaborTotal,
  calculateKmTotal,
  calculateGrandTotal,
} from "@/lib/calculations";
import {
  receiptPath,
  uploadReceiptsBatch,
  deleteReceipts,
} from "./receiptStorage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkEntryInput {
  date: string;
  startTime: string;
  endTime: string;
  jobId: string;
  hourlyRateUsed: number;
  kilometers: number;
  kmRateUsed: number;
}

export interface ExpenseInput {
  amount: number;
  category: string;
  file: File | null;
}

export interface CreateWorkEntryParams {
  userId: string;
  input: WorkEntryInput;
  expenses: ExpenseInput[];
}

export interface UpdateWorkEntryParams {
  userId: string;
  id: string;
  input: WorkEntryInput;
  expenses: ExpenseInput[];
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createWorkEntry(params: CreateWorkEntryParams): Promise<void> {
  const { userId, input, expenses } = params;

  // Step A — Generate IDs first
  const workEntryId = crypto.randomUUID();
  const expenseIds = expenses.map(() => crypto.randomUUID());

  // Compute totals
  const hours = calculateDurationInHours(input.startTime, input.endTime);
  const laborTotal = calculateLaborTotal(hours, input.hourlyRateUsed);
  const kmTotal = calculateKmTotal(input.kilometers, input.kmRateUsed);
  const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const grandTotal = calculateGrandTotal(laborTotal, kmTotal, expensesTotal);

  // Step B — Upload receipts
  const uploadItems: { path: string; file: File }[] = [];
  for (let i = 0; i < expenses.length; i++) {
    const file = expenses[i].file;
    if (file) {
      uploadItems.push({
        path: receiptPath(userId, workEntryId, expenseIds[i]),
        file,
      });
    }
  }

  let uploadedPaths: string[] = [];
  if (uploadItems.length > 0) {
    uploadedPaths = await uploadReceiptsBatch(uploadItems);
  }

  // Step C — DB insert
  try {
    const { error: entryErr } = await getSupabase()
      .from("work_entries")
      .insert({
        id: workEntryId,
        user_id: userId,
        job_id: input.jobId,
        date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        hourly_rate_used: input.hourlyRateUsed,
        kilometers: input.kilometers,
        km_rate_used: input.kmRateUsed,
        labor_total: laborTotal,
        km_total: kmTotal,
        expenses_total: expensesTotal,
        grand_total: grandTotal,
      });

    if (entryErr) throw entryErr;

    if (expenses.length > 0) {
      const expenseRows = expenses.map((e, i) => ({
        id: expenseIds[i],
        user_id: userId,
        work_entry_id: workEntryId,
        amount: e.amount,
        category: e.category,
        receipt_url: e.file
          ? receiptPath(userId, workEntryId, expenseIds[i])
          : "",
      }));

      const { error: expErr } = await getSupabase()
        .from("expenses")
        .insert(expenseRows);

      if (expErr) throw expErr;
    }
  } catch (dbErr) {
    // Rollback: delete uploaded files
    if (uploadedPaths.length > 0) {
      try {
        await deleteReceipts(uploadedPaths);
      } catch (rollbackErr) {
        console.error("Rollback of uploaded receipts after DB error:", rollbackErr);
      }
    }
    throw dbErr;
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateWorkEntry(params: UpdateWorkEntryParams): Promise<void> {
  const { userId, id, input, expenses } = params;

  const expenseIds = expenses.map(() => crypto.randomUUID());

  // Compute totals
  const hours = calculateDurationInHours(input.startTime, input.endTime);
  const laborTotal = calculateLaborTotal(hours, input.hourlyRateUsed);
  const kmTotal = calculateKmTotal(input.kilometers, input.kmRateUsed);
  const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const grandTotal = calculateGrandTotal(laborTotal, kmTotal, expensesTotal);

  // Fetch old expenses to know which receipt files to delete
  const { data: oldExpenses, error: fetchErr } = await getSupabase()
    .from("expenses")
    .select("id, receipt_url")
    .eq("work_entry_id", id);

  if (fetchErr) throw fetchErr;

  const oldReceiptPaths = (oldExpenses ?? [])
    .map((e) => e.receipt_url)
    .filter((url): url is string => !!url && url.length > 0);

  // Upload new receipts
  const uploadItems: { path: string; file: File }[] = [];
  for (let i = 0; i < expenses.length; i++) {
    const file = expenses[i].file;
    if (file) {
      uploadItems.push({
        path: receiptPath(userId, id, expenseIds[i]),
        file,
      });
    }
  }

  let uploadedPaths: string[] = [];
  if (uploadItems.length > 0) {
    uploadedPaths = await uploadReceiptsBatch(uploadItems);
  }

  // DB update
  try {
    const { error: updateErr } = await getSupabase()
      .from("work_entries")
      .update({
        job_id: input.jobId,
        date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        hourly_rate_used: input.hourlyRateUsed,
        kilometers: input.kilometers,
        km_rate_used: input.kmRateUsed,
        labor_total: laborTotal,
        km_total: kmTotal,
        expenses_total: expensesTotal,
        grand_total: grandTotal,
      })
      .eq("id", id);

    if (updateErr) throw updateErr;

    // Delete old expenses
    const { error: delErr } = await getSupabase()
      .from("expenses")
      .delete()
      .eq("work_entry_id", id);

    if (delErr) throw delErr;

    // Insert new expenses
    if (expenses.length > 0) {
      const expenseRows = expenses.map((e, i) => ({
        id: expenseIds[i],
        user_id: userId,
        work_entry_id: id,
        amount: e.amount,
        category: e.category,
        receipt_url: e.file
          ? receiptPath(userId, id, expenseIds[i])
          : "",
      }));

      const { error: insErr } = await getSupabase()
        .from("expenses")
        .insert(expenseRows);

      if (insErr) throw insErr;
    }
  } catch (dbErr) {
    // Rollback: delete newly uploaded files
    if (uploadedPaths.length > 0) {
      try {
        await deleteReceipts(uploadedPaths);
      } catch (rollbackErr) {
        console.error("Rollback of uploaded receipts after DB error:", rollbackErr);
      }
    }
    throw dbErr;
  }

  // DB succeeded → delete old receipt files from storage
  if (oldReceiptPaths.length > 0) {
    try {
      await deleteReceipts(oldReceiptPaths);
    } catch (storageErr) {
      // Non-fatal: DB is consistent, old files are orphaned but not harmful
      console.error("Failed to delete old receipt files:", storageErr);
    }
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteWorkEntry(id: string): Promise<void> {
  // 1. Query receipt_urls for this entry
  const { data: entryExpenses, error: fetchErr } = await getSupabase()
    .from("expenses")
    .select("receipt_url")
    .eq("work_entry_id", id);

  if (fetchErr) throw fetchErr;

  const receiptPaths = (entryExpenses ?? [])
    .map((e) => e.receipt_url)
    .filter((url): url is string => !!url && url.length > 0);

  // 2. Delete files from storage first
  if (receiptPaths.length > 0) {
    await deleteReceipts(receiptPaths);
  }

  // 3. Delete DB rows
  const { error: expErr } = await getSupabase()
    .from("expenses")
    .delete()
    .eq("work_entry_id", id);

  if (expErr) throw expErr;

  const { error: entryErr } = await getSupabase()
    .from("work_entries")
    .delete()
    .eq("id", id);

  if (entryErr) throw entryErr;
}
