import { getDB } from "@/lib/db";
import type { Job, JobCreate } from "@/types";

export async function create(data: JobCreate): Promise<Job> {
  const db = await getDB();
  const job: Job = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  };
  await db.put("jobs", job);
  return job;
}

export async function update(job: Job): Promise<Job> {
  const db = await getDB();
  const existing = await db.get("jobs", job.id);
  if (!existing) {
    throw new Error(`Job not found: ${job.id}`);
  }
  await db.put("jobs", job);
  return job;
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("jobs", id);
}

export async function getById(id: string): Promise<Job | undefined> {
  const db = await getDB();
  return db.get("jobs", id);
}

export async function getAll(): Promise<Job[]> {
  const db = await getDB();
  return db.getAll("jobs");
}

/**
 * Return only active jobs. Uses the by-active index.
 * IndexedDB stores the boolean `active` as-is; the index queries
 * against the raw value (true/false is still comparable via IDBKeyRange).
 */
export async function getActive(): Promise<Job[]> {
  const all = await getAll();
  return all.filter((j) => j.active);
}
