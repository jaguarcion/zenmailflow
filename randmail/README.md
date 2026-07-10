# randmail

Random disposable email over **bill.work.gd**, driven from a Telegram bot, using the
[DNSExit DNS API](https://dnsexit.com/dns/dns-api/).

## How it works

1. In Telegram, a user sends `/new`.
2. The bot generates a random address `xxxxxxxxxx@yyyyyyyyyy.bill.work.gd` and creates an
   **MX record** for `yyyyyyyyyy.bill.work.gd` pointing at the static mail server
   `dfssdfsdfdsfgdg.work.gd` (via the DNSExit API).
3. Mail sent to that address is routed (by MX) to `dfssdfsdfdsfgdg.work.gd`, whose A record
   must point at **this app's SMTP server**.
4. This app receives the mail on port 25, parses it, and forwards it back to the Telegram
   chat that requested the address (attachments included).

The subdomain (`yyyyyyyyyy`) is the routing key: it has its own MX and is mapped to a chat.
Any localpart works; the localpart is randomized only for looks.

## Requirements (operational — read this)

To actually **receive** mail you need:

- A host with a **public IP** and **inbound TCP port 25 open** (most home ISPs and many
  cloud providers block 25 by default — check / request unblock).
- The A record of **`dfssdfsdfdsfgdg.work.gd` pointed at that host's public IP.**
  This app does **not** touch that record (only `bill.work.gd` is edited). Set it once in
  your DNSExit dashboard.
- Run the app **as root** (or grant `cap_net_bind_service`) so it can bind port 25.

DNS notes: DNSExit forces a **TTL of 8 hours** on records regardless of the requested TTL,
so newly created / deleted MX records can take up to 8h to fully propagate/expire.

## Setup

```bash
npm install
cp .env.example .env   # values are prefilled; adjust if needed
```

`.env`:

| var | meaning |
|-----|---------|
| `DNSEXIT_API_KEY` | DNSExit API key |
| `BASE_DOMAIN` | zone the API may edit (`bill.work.gd`) |
| `MAIL_SERVER` | static MX target (`dfssdfsdfdsfgdg.work.gd`) — you point its A record |
| `MX_PRIORITY` / `MX_TTL` | MX record priority / requested TTL |
| `BOT_TOKEN` | Telegram bot token |
| `SMTP_PORT` / `SMTP_HOST` | where the SMTP receiver binds (default `0.0.0.0:25`) |
| `LABEL_LEN` | length of the random labels |
| `STORE_FILE` | JSON file mapping address → chat |

## Run

```bash
sudo -E npm start      # -E keeps your env; needed to bind port 25
```

## Bot commands

- `/new` — create a fresh random address
- `/list` — list your active addresses
- `/del <address>` — delete an address (removes its MX)

## Files

- `src/dnsexit.js` — DNSExit API client (`addMx` / `deleteMx`)
- `src/telegram.js` — bot + commands
- `src/smtp.js` — inbound SMTP server → Telegram forwarding
- `src/store.js` — persistent address→chat map
- `src/index.js` — wiring
