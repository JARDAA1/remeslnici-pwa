/**
 * IndexedDB setup using the `idb` wrapper library.
 *
 * Design decisions:
 * - Single shared database instance (singleton via module scope).
 * - DB version 1 creates all three object stores with their indexes.
 * - Booleans (Job.active) are stored as 0/1 in the index because
 *   IndexedDB cannot natively index boolean values.
 */

import { openDB, type IDBPDatabase } from "idb";
import type { RemeslniciDB } from "@/types";

const DB_NAME = "remeslnici-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RemeslniciDB>> | null = null;

/**
 * Returns the singleton database instance, creating it on first call.
 * Safe to call from any client component — the promise is cached.
 */
export function getDB(): Promise<IDBPDatabase<RemeslniciDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RemeslniciDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // -- Jobs --
        const jobStore = db.createObjectStore("jobs", { keyPath: "id" });
        jobStore.createIndex("by-active", "active");

        // -- Work Entries --
        const workEntryStore = db.createObjectStore("workEntries", {
          keyPath: "id",
        });
        workEntryStore.createIndex("by-date", "date");
        workEntryStore.createIndex("by-jobId", "jobId");

        // -- Expenses --
        const expenseStore = db.createObjectStore("expenses", {
          keyPath: "id",
        });
        expenseStore.createIndex("by-workEntryId", "workEntryId");
      },
    });
  }

  return dbPromise;
}
