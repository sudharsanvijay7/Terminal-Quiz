# TERMINAL QUIZ — LAN Symposium Platform

A self-contained local web portal for the college Terminal Quiz. It is designed for ~60 lab computers connecting to one coordinator laptop over the same LAN.

## What is included
- Attractive terminal/cyber themed participant portal
- Participant registration with unique register number
- 20-question Round 1, 20 minutes, 20 marks
- Server-side answer validation and scoring
- Round 2 with 5 simulated Linux terminal challenges, 30 minutes
- Safe simulated terminal: student commands never execute on the host OS
- Admin control center
- Start/end round controls
- Live participant status and scores
- Audit log
- Final leaderboard publication
- CSV export endpoint
- Automatic JSON database backups every 5 minutes
- No cloud database or internet required

## Requirements
- Windows 10/11, macOS or Linux coordinator laptop
- Node.js 18+ (Node 20+ recommended)
- All lab PCs and coordinator laptop on the same LAN

## Run
Open a terminal in this folder:

    node server/index.js

The console prints the LAN address, for example:

    LAN: http://192.168.1.10:3000

Students open that address in Chrome/Edge.

Admin opens the same address and clicks **ADMIN CONTROL**.

Default admin password is `admin123` only for local testing. Before the real event, set an environment variable:

PowerShell:

    $env:ADMIN_PASSWORD="YourStrongPassword"
    node server/index.js

Command Prompt:

    set ADMIN_PASSWORD=YourStrongPassword
    node server/index.js

## Windows Firewall
If the lab PCs cannot open the page, allow Node.js through Windows Defender Firewall, or create an inbound TCP rule for port 3000. Ask the lab/network administrator if client-to-client traffic is blocked.

## Find the laptop IP

    ipconfig

Look for the IPv4 address of the active Ethernet/Wi-Fi adapter. Do not use `127.0.0.1` on the student PCs.

## Event-day procedure
1. Connect coordinator laptop to the lab LAN.
2. Start the server.
3. Open the LAN URL on the coordinator laptop.
4. Open Admin Control and sign in.
5. Test one lab PC.
6. Have all 60 participants register with their unique register numbers.
7. Start Round 1.
8. End Round 1 (or let its 20-minute timer expire).
9. Start Round 2.
10. Participants solve five terminal challenges.
11. End Round 2 (or let its 30-minute timer expire).
12. Publish leaderboard.
13. Export CSV.

## Important network test
From a lab PC, open:

    http://COORDINATOR-IP:3000

If it does not load, first check that the PC can ping the coordinator laptop and that the Windows firewall/network isolation is not blocking port 3000.

## Terminal safety
Round 2 uses an in-memory simulated terminal rather than a real host shell. Do not replace it with `child_process.exec()` or another direct shell execution mechanism.

## Data
The event data is stored in `data/db.json`. Backups are written under `backups/`. Do not expose these folders through the web server.

## Reset before a fresh event
Stop the server and delete `data/db.json`, then restart. A new database is created automatically.
