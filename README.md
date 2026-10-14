# DeceptiGuard

## What it is
DeceptiGuard is an insider threat detection platform for college labs and viva demonstrations.
It plants fake traps (decoy files, fake keys, fake admin accounts, and trap web addresses) that real employees have no reason to touch.
Any touch creates an immediate alert, updates user risk scores, and logs the evidence into an immutable SHA-256 hash chain with exportable PDF forensic reports.

## How to run
```bash
git clone <repo-url>
cd "CSDF Mini Project"
npm install
npm run seed && npm start
```
Open **http://localhost:5001** in your browser. All accounts use password: `Password123!`.

## 5-Minute Demo Steps
1. **Dashboard Overview**: Open the Dashboard to observe the 4 metric cards (Total Alerts, Critical Alerts, Open Cases, Traps Touched), the real-time alert feed, and the live risk leaderboard.
2. **Run Attack 1 (Curious Intern)**: Go to **Test Attacks** and click **1. Curious Intern**. Notice `samarth` opens the salary trap file, triggering Rule **R1** (100 pts) with measured time-to-detect in milliseconds.
3. **Run Attack 2 (Fake Admin Login)**: Click **2. Fake Admin Login**. Notice `admin.backup` triggers Rule **R2** (90 pts) and trap address hit triggers Rule **R1** (100 pts).
4. **Run Attacks 3 & 4**: Click **3. Night Download** (Rule **R4** + **R5**, 45 pts at 2 AM) and **4. Stolen Key** (Rule **R3**, 100 pts).
5. **Run Attack 5 (Normal Day)**: Click **5. Normal Day**. Notice `mugdha` accesses a standard document at 11 AM with **0 alerts** (0% false positives).
6. **Verify & Tamper Evidence Chain**: Go to **Evidence and Cases**. Click **Check Evidence** (green: all blocks valid). Click **Tamper Test** (red: block was changed). Click **Fix Evidence** (green: restored).
7. **Download Forensic Case Report**: In the Cases table, click **Download PDF** to export a court-admissible forensic dossier with SHA-256 block hashes and dynamic root cause analysis.

## Where to Change Things (settings.js)
Everything you need to change for your viva or lab presentation is centralized in ONE file:
**`server/src/config/settings.js`**
- **Penalty Points & Rules**: Edit point values, names, or severity under `RULES` (R1 to R5).
- **Users**: Add or rename accounts under `USERS` (currently `onkar`, `mugdha`, `samarth`, `aniket`, `pranav`, `admin.backup`).
- **Traps**: Change decoy file names, canary key, decoy account, or endpoint under `TRAPS`.
- **Business Hours & Download Limits**: Modify working hours (`9` to `19`) or bulk threshold (`10` files / `5` min).
- **Genesis Hash**: Standard 64 zeros (`0000000000000000000000000000000000000000000000000000000000000000`).

After changing `settings.js`, simply run `npm run seed` to apply your updates!

## Limits
- **Lab simulation only**: Built for educational demonstration, viva exams, and controlled cyber defense labs.
- **Single-node ledger**: Uses an in-database SHA-256 sequential hash chain (ISO/IEC 27037 standard), not a multi-node peer-to-peer blockchain.
- **In-memory session state**: JWT tokens expire after 8 hours; restarting the server requires re-authenticating or clicking the user persona chip.
