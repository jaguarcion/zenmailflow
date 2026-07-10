import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';
import { randomLabel } from './random.js';
import { addMx, deleteMx } from './dnsexit.js';
import { waitForMx } from './dnsverify.js';
import { addMailbox, listByChat, removeByDomain, hasDomain } from './store.js';

export function createBot() {
  const bot = new TelegramBot(config.botToken, { polling: true });

  bot.onText(/^\/start\b/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      'Random mail bot.\n\n' +
        '/new — create a fresh random address on ' + config.baseDomain + '\n' +
        '/list — show your active addresses\n' +
        '/del <address> — delete one'
    );
  });

  bot.onText(/^\/(new|gen)\b/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      // Generate a unique subdomain label (has its own MX -> routing key).
      let label;
      do {
        label = randomLabel(config.labelLen);
      } while (hasDomain(`${label}.${config.baseDomain}`));

      const local = randomLabel(config.labelLen);
      const domain = `${label}.${config.baseDomain}`;
      const address = `${local}@${domain}`;

      await addMx(label);
      await addMailbox({
        chatId,
        address,
        label,
        domain,
        createdAt: new Date().toISOString(),
      });

      // DNSExit needs ~20-40s to publish the record to all nameservers. Tell the
      // user to wait, then confirm once the MX is live everywhere so mail sent
      // to the address doesn't bounce with "domain not found".
      const pending = await bot.sendMessage(
        chatId,
        `⏳ Creating \`${address}\`\nWaiting for DNS to propagate…`,
        { parse_mode: 'Markdown' }
      );

      const ready = await waitForMx(domain, config.mailServer, { timeoutMs: 90000 });
      const note = ready
        ? '✅ Live on all nameservers — ready to receive mail.'
        : '⚠️ Not visible on every nameserver yet — wait ~1 min before using.';

      await bot.editMessageText(
        `📮 Your address:\n\`${address}\`\n\n${note}\nMail sent here is forwarded to this chat.`,
        { chat_id: chatId, message_id: pending.message_id, parse_mode: 'Markdown' }
      );
    } catch (err) {
      await bot.sendMessage(chatId, `❌ Could not create address: ${err.message}`);
    }
  });

  bot.onText(/^\/list\b/, (msg) => {
    const boxes = listByChat(msg.chat.id);
    if (boxes.length === 0) {
      bot.sendMessage(msg.chat.id, 'No active addresses. Use /new.');
      return;
    }
    const lines = boxes.map((b) => `• \`${b.address}\``).join('\n');
    bot.sendMessage(msg.chat.id, `Your addresses:\n${lines}`, { parse_mode: 'Markdown' });
  });

  bot.onText(/^\/del\s+(\S+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const address = match[1].trim().toLowerCase();
    const domain = address.includes('@') ? address.split('@')[1] : address;
    const boxes = listByChat(chatId);
    const box = boxes.find((b) => b.domain === domain || b.address.toLowerCase() === address);
    if (!box) {
      bot.sendMessage(chatId, 'Not found among your addresses.');
      return;
    }
    try {
      await deleteMx(box.label);
      await removeByDomain(box.domain);
      bot.sendMessage(chatId, `🗑 Deleted ${box.address}`);
    } catch (err) {
      bot.sendMessage(chatId, `❌ Could not delete: ${err.message}`);
    }
  });

  bot.on('polling_error', (err) => {
    console.error('[telegram] polling error:', err.message);
  });

  return bot;
}
