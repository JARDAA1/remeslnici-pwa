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

      {error && <p className="error-message">{error}</p>}

      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <h2>{editingId ? "Upravit zakázku" : "Nová zakázka"}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            Název:
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Klient:
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="submit" data-primary="">
              {editingId ? "Uložit" : "Přidat"}
            </button>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {jobs.map((job) => (
            <div
              key={job.id}
              style={{
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 8,
                background: job.active ? "#fff" : "#f9f9f9",
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 16 }}>{job.name}</strong>
                {!job.active && (
                  <span
                    style={{
                      fontSize: 12,
                      color: "#999",
                      marginLeft: 8,
                    }}
                  >
                    (neaktivní)
                  </span>
                )}
              </div>
              <div style={{ fontSize: 14, color: "#555", marginBottom: 8 }}>
                <div>Klient: {job.client || "–"}</div>
                <div>Sazba: {Number(job.default_hourly_rate).toFixed(2)} Kč/h</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => startEdit(job)}
                  data-compact=""
                  style={{ flex: 1 }}
                >
                  Upravit
                </button>
                <button
                  onClick={() => handleDelete(job.id)}
                  data-compact=""
                  style={{ flex: 1 }}
                >
                  Smazat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
