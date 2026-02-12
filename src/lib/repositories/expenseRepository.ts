import { getDB } from "@/lib/db";
import type { Expense, ExpenseCreate } from "@/types";

/**
 * @internal Use workEntryService.createWorkEntry() to create expenses
 * alongside their parent WorkEntry in a single transaction.
 * Direct create() bypasses transactional consistency and total recalculation.
 */
export async function create(data: ExpenseCreate): Promise<Expense> {
  const db = await getDB();
  const expense: Expense = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  };
  await db.put("expenses", expense);
  return expense;
}

export async function update(expense: Expense): Promise<Expense> {
  const db = await getDB();
  const existing = await db.get("expenses", expense.id);
  if (!existing) {
    throw new Error(`Expense not found: ${expense.id}`);
  }
  await db.put("expenses", expense);
  return expense;
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("expenses", id);
}

export async function getById(id: string): Promise<Expense | undefined> {
  const db = await getDB();
  return db.get("expenses", id);
}

export async function getAll(): Promise<Expense[]> {
  const db = await getDB();
  return db.getAll("expenses");
}

/**
 * Return all expenses linked to a specific work entry.
 * Uses the by-workEntryId index.
 */
export async function getByWorkEntryId(
  workEntryId: string
): Promise<Expense[]> {
  const db = await getDB();
  return db.getAllFromIndex("expenses", "by-workEntryId", workEntryId);
}

/**
 * getByDateRange is not directly applicable to expenses (they don't have
 * their own date field — they inherit it from the parent WorkEntry).
 * To query expenses by date, first query WorkEntries by date range,
 * then fetch expenses for each entry.
 */
