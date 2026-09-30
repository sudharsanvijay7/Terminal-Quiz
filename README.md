# Terminal Quiz — LAN Symposium Website

A local-network event platform for the college Terminal Quiz symposium. The coordinator laptop runs the server; up to 60 lab computers open the same LAN URL.

## Separate pages

- `/` or `/index.html` — public event landing page
- `/participant-login.html` — participant login
- `/participant.html` — participant waiting/event router
- `/round1.html` — Round 1 technical quiz
- `/round2.html` — Round 2 simulated terminal
- `/leaderboard.html` — published final leaderboard
- `/admin-login.html` — coordinator login
- `/admin.html` — coordinator dashboard

Every major screen has its own HTML file and page-specific JavaScript. Shared API/auth/UI helpers are in `public/assets/common.js`; styling is in `public/assets/style.css`.

## Run

1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run:

```bash
node server/index.js
```

The console prints the LAN address, for example:

```text
Local: http://localhost:3000
LAN:   http://192.168.1.10:3000
```

Open the LAN address on every lab computer.

## Admin

Open `/admin-login.html` or click **ADMIN CONTROL** on the home page.

Default development password: `admin123`.

For the actual event, set `ADMIN_PASSWORD` in the environment before starting the server.

## Event flow

1. Students open `participant-login.html` and register.
2. They wait on `participant.html`.
3. Admin starts Round 1.
4. Participants are sent to `round1.html`.
5. When Round 1 ends, participants return to the waiting page.
6. Admin starts Round 2.
7. Participants are sent to `round2.html`.
8. Admin ends Round 2 and publishes the leaderboard.
9. Participants can open `leaderboard.html`.

## LAN requirements

- Coordinator laptop and all lab computers must be on the same LAN.
- Client-to-client communication must be permitted by the college network.
- Windows Firewall must allow Node.js/the selected port.
- Use the LAN URL printed by the server, not `localhost`, on student computers.

Example:

```text
http://192.168.1.10:3000
```

## Terminal safety

Round 2 uses a simulated terminal. Participant commands are interpreted by the application and are not executed as shell commands on the coordinator laptop.

## Event controls

The admin dashboard supports starting/ending both rounds, publishing the leaderboard, resetting the event, viewing participant status and exporting results.
