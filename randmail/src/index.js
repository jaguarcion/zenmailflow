import { config } from './config.js';
import { loadStore } from './store.js';
import { createBot } from './telegram.js';
import { createSmtpServer } from './smtp.js';

async function main() {
  await loadStore();

  const bot = createBot();
  console.log('[telegram] bot started (polling)');

  // Deliver an incoming email (plus any attachments) to a chat.
  async function onMail(chatId, text, attachments) {
    await bot.sendMessage(chatId, text);
    for (const att of attachments) {
      try {
        await bot.sendDocument(chatId, att.content, {}, { filename: att.filename });
      } catch (err) {
        console.error('[telegram] attachment send failed:', err.message);
      }
    }
  }

  const smtp = createSmtpServer(onMail);
  smtp.listen(config.smtpPort, config.smtpHost, () => {
    console.log(`[smtp] listening on ${config.smtpHost}:${config.smtpPort}`);
    console.log(`[smtp] MX target for new mailboxes: ${config.mailServer}`);
    console.log(`[smtp] base domain: ${config.baseDomain}`);
  });

  const shutdown = () => {
    console.log('\nShutting down…');
    smtp.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
