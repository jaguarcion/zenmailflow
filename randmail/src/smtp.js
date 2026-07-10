import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { config } from './config.js';
import { getByDomain, hasDomain } from './store.js';

const MAX_TG = 3900; // Telegram message hard limit is 4096 chars; leave headroom.

function truncate(s, n = MAX_TG) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '\n…(truncated)' : s;
}

// Build the SMTP server. `onMail(chatId, text, attachments)` is provided by
// index.js and does the actual Telegram delivery.
export function createSmtpServer(onMail) {
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH'],
    banner: 'randmail',

    // Accept a recipient only if its domain is a known mailbox.
    onRcptTo(address, session, callback) {
      const domain = address.address.split('@')[1]?.toLowerCase() || '';
      if (hasDomain(domain)) return callback();
      return callback(new Error('550 No such mailbox'));
    },

    onData(stream, session, callback) {
      simpleParser(stream)
        .then(async (parsed) => {
          // Fan out to every known recipient of this message.
          const rcpts = (session.envelope.rcptTo || [])
            .map((r) => r.address.toLowerCase())
            .filter((a) => hasDomain(a.split('@')[1] || ''));

          const seenChats = new Set();
          for (const rcpt of rcpts) {
            const box = getByDomain(rcpt.split('@')[1]);
            if (!box) continue;
            const key = `${box.chatId}:${rcpt}`;
            if (seenChats.has(key)) continue;
            seenChats.add(key);

            const from = parsed.from?.text || '(unknown)';
            const subject = parsed.subject || '(no subject)';
            const body = parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || '(empty body)';

            const text =
              `📨 New mail for ${rcpt}\n` +
              `From: ${from}\n` +
              `Subject: ${subject}\n` +
              `----------------------------------------\n` +
              truncate(body);

            const attachments = (parsed.attachments || []).map((a) => ({
              filename: a.filename || 'attachment',
              content: a.content,
            }));

            try {
              await onMail(box.chatId, text, attachments);
            } catch (err) {
              console.error('[smtp] forward failed:', err.message);
            }
          }
          callback();
        })
        .catch((err) => {
          console.error('[smtp] parse error:', err.message);
          callback(err);
        });
    },
  });

  server.on('error', (err) => console.error('[smtp] server error:', err.message));
  return server;
}
