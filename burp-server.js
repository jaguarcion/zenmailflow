import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

// Since we're running ES modules, we need to import db correctly if it's an ES module.
// However, the existing db.js is an ES module (export function insertBurpMessage...)
// Wait, `db.js` uses `export default db;`. Let's import it:
import db, { getBurpAddressByDomain, insertBurpMessage } from './lib/db.js';
import { getBurpConfig } from './lib/burp.js';

const config = getBurpConfig();

// Ensure attachments directory exists
const attachmentsDir = path.join(__dirname, 'public', 'uploads', 'burp');
if (!fs.existsSync(attachmentsDir)) {
  fs.mkdirSync(attachmentsDir, { recursive: true });
}

async function onMail(session, stream) {
  return new Promise((resolve, reject) => {
    simpleParser(stream, async (err, parsed) => {
      if (err) {
        console.error('[SMTP] parse error:', err);
        return reject(err);
      }
      
      const recipients = parsed.to?.value || [];
      const recipientAddresses = recipients.map(r => r.address?.toLowerCase()).filter(Boolean);
      
      if (recipientAddresses.length === 0) {
        console.warn('[SMTP] No valid recipient found in email');
        return resolve();
      }

      for (const toAddress of recipientAddresses) {
        const domain = toAddress.split('@')[1];
        if (!domain) continue;

        // Verify if domain exists in our db
        const box = getBurpAddressByDomain(domain);
        if (!box) {
          console.log(`[SMTP] Dropping mail for unknown domain: ${domain}`);
          continue;
        }

        console.log(`[SMTP] Received mail for known box: ${box.address}`);

        // Save attachments
        const savedAttachments = [];
        for (const att of parsed.attachments) {
          try {
            const ext = path.extname(att.filename || '.bin');
            const safeName = crypto.randomBytes(16).toString('hex') + ext;
            const destPath = path.join(attachmentsDir, safeName);
            fs.writeFileSync(destPath, att.content);
            
            savedAttachments.push({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size,
              url: `/uploads/burp/${safeName}`
            });
          } catch (e) {
            console.error(`[SMTP] Failed to save attachment ${att.filename}:`, e);
          }
        }

        const fromAddr = parsed.from?.value?.[0]?.address || 'unknown';
        const subject = parsed.subject || '';
        const textContent = parsed.text || '';
        const htmlContent = parsed.html || '';

        try {
          insertBurpMessage(
            box.id,
            fromAddr,
            subject,
            textContent,
            htmlContent,
            JSON.stringify(savedAttachments)
          );
          console.log(`[SMTP] Mail saved for ${box.address}`);
        } catch (e) {
          console.error(`[SMTP] Failed to insert mail into db for ${box.address}:`, e);
        }
      }
      
      resolve();
    });
  });
}

const smtp = new SMTPServer({
  name: 'burp-mail',
  banner: 'Burp Mail Server',
  authOptional: true,
  disableReverseLookup: true,
  onData(stream, session, callback) {
    onMail(session, stream)
      .then(() => callback())
      .catch((err) => callback(err));
  }
});

const port = process.env.BURP_SMTP_PORT || 25;
const host = process.env.BURP_SMTP_HOST || '0.0.0.0';

smtp.listen(port, host, () => {
  console.log(`[SMTP] Server listening on ${host}:${port}`);
  console.log(`[SMTP] Configured Base Domain: ${config.baseDomain}`);
});

const shutdown = () => {
  console.log('\\n[SMTP] Shutting down…');
  smtp.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
