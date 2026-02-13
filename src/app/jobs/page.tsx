"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/AuthProvider";
import type { Database } from "@/lib/supabase/types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

export default function JobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("");
  const [active, setActive] = useState(true);

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadJobs() {
    if (!user) return;
    try {
      const { data, error: err } = await getSupabase()
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setJobs(data ?? []);
    } catch (e) {
      console.error("Failed to load jobs", e);
      setError("Nepodařilo se načíst zakázky.");
    }
  }

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function resetForm() {
    setName("");
    setClient("");
    setDefaultHourlyRate("");
    setActive(true);
    setEditingId(null);
  }

  function startEdit(job: JobRow) {
    setEditingId(job.id);
    setName(job.name);
    setClient(job.client);
    setDefaultHourlyRate(String(job.default_hourly_rate));
    setActive(job.active);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!user) return;

    const rate = parseFloat(defaultHourlyRate);
    if (!name.trim()) {
      setError("Název je povinný.");
      return;
    }
    if (isNaN(rate) || rate < 0) {
      setError("Hodinová sazba musí být platné nezáporné číslo.");
      return;
    }

    try {
      if (editingId) {
        const { error: err } = await getSupabase()
          .from("jobs")
          .update({
            name: name.trim(),
            client: client.trim(),
            default_hourly_rate: rate,
            active,
          })
          .eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await getSupabase()
          .from("jobs")
          .insert({
            user_id: user.id,
            name: name.trim(),
            client: client.trim(),
            default_hourly_rate: rate,
            active,
          });
        if (err) throw err;
      }
      resetForm();
      await loadJobs();
    } catch (e) {
      console.error("Failed to save job", e);
      setError("Nepodařilo se uložit zakázku.");
    }
  }

  async function handleDelete(id: string) {
    setError("");
    try {
      const { error: err } = await getSupabase()
        .from("jobs")
        .delete()
        .eq("id", id);
      if (err) throw err;
      await loadJobs();
    } catch (e) {
      console.error("Failed to delete job", e);
      setError("Nepodařilo se smazat zakázku.");
    }
  }

  return (
    <div>
      <h1>Zakázky</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <h2>{editingId ? "Upravit zakázku" : "Nová zakázka"}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
          <label>
            Název:
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Klient:
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Hodinová sazba (Kč):
            <input
              type="number"
              step="0.01"
              min="0"
              value={defaultHourlyRate}
              onChange={(e) => setDefaultHourlyRate(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Aktivní
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit">{editingId ? "Uložit" : "Přidat"}</button>
            {editingId && (
              <button type="button" onClick={resetForm}>
                Zrušit
              </button>
            )}
          </div>
        </div>
      </form>

      {jobs.length === 0 ? (
        <p>Žádné zakázky.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 4 }}>Název</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 4 }}>Klient</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 4 }}>Sazba</th>
              <th style={{ textAlign: "center", borderBottom: "1px solid #ccc", padding: 4 }}>Aktivní</th>
              <th style={{ borderBottom: "1px solid #ccc", padding: 4 }}>Akce</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td style={{ padding: 4 }}>{job.name}</td>
                <td style={{ padding: 4 }}>{job.client}</td>
                <td style={{ padding: 4, textAlign: "right" }}>{Number(job.default_hourly_rate).toFixed(2)} Kč</td>
                <td style={{ padding: 4, textAlign: "center" }}>{job.active ? "Ano" : "Ne"}</td>
                <td style={{ padding: 4, display: "flex", gap: 4 }}>
                  <button onClick={() => startEdit(job)}>Upravit</button>
                  <button onClick={() => handleDelete(job.id)}>Smazat</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
