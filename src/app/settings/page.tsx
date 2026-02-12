"use client";

import { useState, useRef } from "react";
import {
  exportFullBackup,
  downloadBackupFile,
  importFullBackup,
} from "@/lib/services/backupService";

export default function SettingsPage() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    if (exporting) return;
    setError("");
    setMessage("");
    setExporting(true);

    try {
      const backup = await exportFullBackup();
      downloadBackupFile(backup);
      const total =
        backup.jobs.length + backup.workEntries.length + backup.expenses.length;
      setMessage(
        `Export dokončen: ${backup.jobs.length} zakázek, ${backup.workEntries.length} záznamů, ${backup.expenses.length} výdajů (celkem ${total} záznamů).`
      );
    } catch (e) {
      console.error("Export failed", e);
      setError("Nepodařilo se exportovat zálohu.");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (importing) return;
    setError("");
    setMessage("");

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Vyberte soubor se zálohou.");
      return;
    }

    // Read file
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError("Nepodařilo se přečíst soubor.");
      return;
    }

    // Parse JSON
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      setError("Neplatný JSON soubor.");
      return;
    }

    // Confirm
    const confirmed = window.confirm(
      "POZOR: Import zálohy smaže všechna aktuální data a nahradí je daty ze zálohy.\n\nPokračovat?"
    );
    if (!confirmed) return;

    setImporting(true);
    try {
      await importFullBackup(data);
      setMessage("Import dokončen. Data byla obnovena ze zálohy.");
      // Clear file input
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      console.error("Import failed", e);
      const msg = e instanceof Error ? e.message : "Neznámá chyba.";
      setError(`Import selhal: ${msg}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <h1>Nastavení</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {/* Export */}
      <section style={{ marginBottom: 32 }}>
        <h2>Export zálohy</h2>
        <p>Stáhne kompletní zálohu všech dat jako JSON soubor.</p>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{ padding: "8px 16px" }}
        >
          {exporting ? "Exportuji…" : "Export zálohy"}
        </button>
      </section>

      {/* Import */}
      <section>
        <h2>Import zálohy</h2>
        <p>
          Nahraje zálohu ze souboru. <strong>Všechna aktuální data budou smazána</strong> a nahrazena daty ze zálohy.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
          />
          <button
            onClick={handleImport}
            disabled={importing}
            style={{ padding: "8px 16px" }}
          >
            {importing ? "Importuji…" : "Import zálohy"}
          </button>
        </div>
      </section>
    </div>
  );
}
