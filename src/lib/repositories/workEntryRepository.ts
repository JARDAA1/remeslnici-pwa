import { getDB } from "@/lib/db";
import type { WorkEntry, WorkEntryCreate, Expense, ExpenseCreate } from "@/types";

/**
 * @internal Use workEntryService.createWorkEntry() instead.
 * Direct create() bypasses total computation and transactional expense saving.
 * Exposed only for rare cases where a WorkEntry is guaranteed to have zero expenses.
 */
export async function create(data: WorkEntryCreate): Promise<WorkEntry> {
  const db = await getDB();
  const entry: WorkEntry = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  };
  await db.put("workEntries", entry);
  return entry;
}

/**
 * @internal Use workEntryService.createWorkEntry() instead.
 * This is the raw transactional write — it does NOT compute totals.
 * The service layer handles total computation + this write in the correct order.
 */
export async function createWithExpenses(
  data: WorkEntryCreate,
  expenses: ExpenseCreate[]
): Promise<{ entry: WorkEntry; expenses: Expense[] }> {
  const db = await getDB();
  const now = new Date();

  const entry: WorkEntry = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
  };

  const expenseRecords: Expense[] = expenses.map((e) => ({
    ...e,
    id: crypto.randomUUID(),
    workEntryId: entry.id,
    createdAt: now,
  }));

  // Single transaction spanning both object stores
  const tx = db.transaction(["workEntries", "expenses"], "readwrite");

  tx.objectStore("workEntries").put(entry);
  for (const expense of expenseRecords) {
    tx.objectStore("expenses").put(expense);
  }

  // If any put fails, the transaction aborts and nothing is persisted
  await tx.done;

  return { entry, expenses: expenseRecords };
}

/**
 * @internal Use workEntryService.updateWorkEntry() instead.
 * Direct update() bypasses total recomputation and expense replacement.
 */
export async function update(entry: WorkEntry): Promise<WorkEntry> {
  const db = await getDB();
  const existing = await db.get("workEntries", entry.id);
  if (!existing) {
    throw new Error(`WorkEntry not found: ${entry.id}`);
  }
  await db.put("workEntries", entry);
  return entry;
}

/**
 * @internal Use workEntryService.deleteWorkEntry() instead.
 * Deletes only the entry — does NOT clean up associated expenses.
 */
export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("workEntries", id);
}

/**
 * @internal Use workEntryService.deleteWorkEntry() instead.
 * Atomically delete a WorkEntry and all its associated Expenses.
 */
export async function removeWithExpenses(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["workEntries", "expenses"], "readwrite");

  // Find all expenses linked to this entry
  const expenses = await tx
    .objectStore("expenses")
    .index("by-workEntryId")
    .getAll(id);

  for (const expense of expenses) {
    tx.objectStore("expenses").delete(expense.id);
  }
  tx.objectStore("workEntries").delete(id);

  await tx.done;
}

export async function getById(id: string): Promise<WorkEntry | undefined> {
  const db = await getDB();
  return db.get("workEntries", id);
}

export async function getAll(): Promise<WorkEntry[]> {
  const db = await getDB();
  return db.getAll("workEntries");
}

/**
 * Return work entries whose `date` field falls within [from, to] inclusive.
 * Both parameters are ISO date strings (YYYY-MM-DD).
 * Uses the by-date index with an IDBKeyRange for efficient querying.
 */
export async function getByDateRange(
  from: string,
  to: string
): Promise<WorkEntry[]> {
  const db = await getDB();
  const range = IDBKeyRange.bound(from, to);
  return db.getAllFromIndex("workEntries", "by-date", range);
}

/**
 * Return all work entries for a given job.
 */
export async function getByJobId(jobId: string): Promise<WorkEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex("workEntries", "by-jobId", jobId);
}
