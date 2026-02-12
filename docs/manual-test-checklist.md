# Manuální testovací checklist

Všechny testy provádět v prohlížeči (Chrome/Firefox). PWA používá IndexedDB — bez prohlížeče nelze ověřit transakční chování.

---

## 1. Backup Validation Tests

### 1.1 Základní export
- [ ] Otevřít `/settings`
- [ ] Kliknout "Exportovat zálohu"
- [ ] Ověřit, že se stáhne soubor `remeslnici-backup-YYYY-MM-DD.json`
- [ ] Otevřít JSON — musí obsahovat `version: 1`, `exportedAt`, `jobs[]`, `workEntries[]`, `expenses[]`

### 1.2 Smazání povinného klíče
- [ ] Vzít exportovaný JSON
- [ ] Smazat klíč `version`
- [ ] Importovat na `/settings`
- **Očekáváno:** Import selže s chybou o chybějící verzi
- **Ověřit:** Existující data v DB se nezměnila (jít na `/entries`, `/jobs`)

### 1.3 Změna version na neplatnou hodnotu
- [ ] Vzít exportovaný JSON
- [ ] Změnit `"version": 1` na `"version": 99`
- [ ] Importovat
- **Očekáváno:** Import selže — "Nepodporovaná verze zálohy: 99"

### 1.4 Smazání pole z expense
- [ ] Vzít exportovaný JSON s alespoň 1 expense
- [ ] Smazat klíč `amount` z prvního expense objektu
- [ ] Importovat
- **Očekáváno:** Import selže — "expenses[0]: chybí amount"
- **Ověřit:** DB nezměněna

### 1.5 Změna typu amount (number → string)
- [ ] Vzít exportovaný JSON
- [ ] Změnit `"amount": 150` na `"amount": "sto padesát"`
- [ ] Importovat
- **Očekáváno:** Import selže — validace typu

### 1.6 Poškození createdAt
- [ ] Vzít exportovaný JSON
- [ ] Změnit `createdAt` v libovolném job na `"not-a-date"`
- [ ] Importovat
- **Očekáváno:** Import proběhne (rehydrace volá `new Date("not-a-date")` → Invalid Date)
- **POZOR:** Toto je potenciální bug — viz sekce "Známé rizikové body"

### 1.7 Duplicitní ID
- [ ] Vzít exportovaný JSON
- [ ] Duplikovat jeden job záznam (copy-paste) se stejným `id`
- [ ] Importovat
- **Očekáváno:** Import selže — "Duplicitní ID v jobs: xxx"
- **Ověřit:** DB nezměněna

### 1.8 Částečné smazání pole (prázdný array místo objektů)
- [ ] Vzít exportovaný JSON
- [ ] Smazat obsah `workEntries` → `"workEntries": []`
- [ ] Importovat
- **Očekáváno:** Import proběhne úspěšně — prázdné pole je validní
- **Ověřit:** DB nyní obsahuje pouze jobs + expenses (workEntries vymazány)

---

## 2. Atomic Restore Tests

### 2.1 Transakce při validních datech
- [ ] Vytvořit testovací data (přes `/debug` — "Generovat 100 záznamů")
- [ ] Exportovat
- [ ] Vymazat DB (přes `/debug` — "Vymazat databázi")
- [ ] Importovat zálohu
- **Očekáváno:** Všechna data obnovena — počty sedí na `/debug` "Vypsat počty"

### 2.2 Abort při nevalidním záznamu
- [ ] Mít existující data v DB (alespoň 1 job, 1 entry)
- [ ] Připravit JSON se 100 validními jobs + 1 nevalidním (chybí `name`)
- [ ] Importovat
- **Očekáváno:** Validace selže PŘED transakcí — stará data zůstanou
- **Ověřit:** Na `/entries` a `/jobs` vidím původní záznamy

### 2.3 Ověření, že clear+insert je atomický
- [ ] Mít existující data
- [ ] Připravit velký validní JSON (500 entries z `/debug`)
- [ ] Importovat
- **Očekáváno:** Stará data nahrazena novými — ne mix starých a nových

---

## 3. Timezone Consistency Tests

### 3.1 Základní roundtrip
- [ ] Na `/work` spustit a dokončit práci (zaznamenat si přesný čas začátku/konce)
- [ ] Jít na `/entries` — ověřit zobrazené datum a čas
- [ ] Exportovat zálohu
- [ ] Otevřít JSON — najít `startTime` a `endTime` v workEntries
- [ ] Ověřit, že obsahují timezone offset (např. `+02:00`)
- [ ] Ověřit, že hodiny odpovídají lokálnímu času, NE UTC

### 3.2 Roundtrip bez posunu
- [ ] Exportovat zálohu
- [ ] Poznamenat si `startTime`, `endTime`, `createdAt` jednoho záznamu
- [ ] Importovat stejnou zálohu zpět
- [ ] Znovu exportovat
- [ ] Porovnat `startTime` a `endTime` — musí být identické (řetězcová shoda)
- **Kritické:** Nesmí se změnit ani o sekundu

### 3.3 DST hranice (23:30)
- [ ] Na `/entries` upravit existující záznam
- [ ] Nastavit začátek na **29.3.2025 23:30** (noc přechodu na letní čas v CZ)
- [ ] Uložit
- [ ] Ověřit na `/entries`, že datum je stále 29.3., ne 30.3.
- [ ] Exportovat → importovat → ověřit znovu

### 3.4 createdAt preservace
- [ ] Exportovat zálohu
- [ ] V JSON najít `createdAt` libovolného záznamu (bude jako ISO string)
- [ ] Importovat
- [ ] Znovu exportovat
- [ ] Porovnat `createdAt` — musí být identický timestamp

---

## 4. Large Dataset Test

### 4.1 Generování velkého datasetu
- [ ] Na `/debug` kliknout "Generovat 100 záznamů" 5× (= 500 entries + expenses)
- [ ] Nebo použít jednorázové tlačítko "Generovat 500 záznamů"
- [ ] Ověřit počty na `/debug`

### 4.2 Export velkého datasetu
- [ ] Exportovat zálohu
- [ ] Ověřit velikost souboru (měl by být řádově stovky KB až jednotky MB)
- [ ] Ověřit, že JSON je validní (otevřít v editoru, žádný truncation)

### 4.3 Import velkého datasetu
- [ ] Vymazat DB (přes `/debug`)
- [ ] Importovat zálohu se 500+ záznamy
- [ ] Měřit čas importu (nesmí timeout — prohlížeč nesmí zamrznout)
- [ ] Ověřit počty — musí sedět s exportem
- **Očekáváno:** Import dokončen do 5 sekund, žádný partial restore

### 4.4 Žádný partial restore
- [ ] Importovat velkou zálohu
- [ ] Během importu (pokud je pomalý) zavřít tab
- [ ] Znovu otevřít — DB buď má VŠECHNA data nebo ŽÁDNÁ (transakce)

---

## 5. Session Persistence Test

### 5.1 Reload během běžící práce
- [ ] Na `/work` kliknout START
- [ ] Počkat 10 sekund
- [ ] Reload stránky (F5 / Ctrl+R)
- **Očekáváno:** Stránka se znovu otevře ve stavu "Práce běží" s pokračujícím časem
- **Ověřit:** Čas odpovídá skutečné době od startu, ne od reloadu

### 5.2 Zavření prohlížeče
- [ ] Na `/work` kliknout START
- [ ] Zavřít prohlížeč úplně
- [ ] Znovu otevřít aplikaci
- **Očekáváno:** Session obnovena, čas pokračuje

### 5.3 Úspěšné uložení vymaže session
- [ ] Spustit práci, zastavit, uložit
- [ ] Ověřit v DevTools → Application → Local Storage → klíč `remeslnici-active-session`
- **Očekáváno:** Klíč neexistuje (byl smazán po uložení)

### 5.4 Zrušení vymaže session
- [ ] Spustit práci
- [ ] Kliknout "Zrušit"
- **Očekáváno:** Session smazána, localStorage prázdný

---

## Známé rizikové body

### Rehydrace createdAt
`rehydrateJob/WorkEntry/Expense` volá `new Date(raw.createdAt)`. Pokud je `createdAt` v JSON poškozený řetězec (ne validní ISO), vznikne `Invalid Date`. Import proběhne, ale záznam má neplatný timestamp. **Doporučení:** Přidat validaci formátu createdAt do `validateJob/WorkEntry/Expense`.

### exportedAt používá UTC
`exportFullBackup()` nastavuje `exportedAt: new Date().toISOString()` — tj. UTC. Není to problém pro funkčnost (slouží jen jako metadata), ale je to nekonzistentní s ostatními časy, které jsou local.

### workEntries validace — nekontroluje všechna pole
`validateWorkEntry` kontroluje jen `id, date, startTime, endTime, jobId, hourlyRateUsed, grandTotal`. Nekontroluje `kilometers, kmRateUsed, laborTotal, kmTotal, expensesTotal`. Chybějící numerická pole se importují jako `undefined` → potenciální NaN v UI.
