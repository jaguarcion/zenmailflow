import { NextResponse } from 'next/server';
import { getAdobeAccountByAccessToken, getActiveUnassignedAdobeAccount, updateAdobeAccountClient, updateClientAdobeAccount, getClientById } from '@/lib/db';

// [SECURITY] C-01+C-02: Use access_token for lookup instead of sequential ID.
export async function POST(request, { params }) {
  const { id: accessToken } = await params;
  
  if (!accessToken || typeof accessToken !== 'string') {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }

  // [SECURITY] C-02: Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(accessToken)) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  try {
    const oldAccount = getAdobeAccountByAccessToken(accessToken);
    if (!oldAccount) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    
    const clientId = oldAccount.assigned_client_id;
    if (!clientId) return NextResponse.json({ success: false, error: 'Account not assigned to any client' }, { status: 400 });
    
    // Find a new active account
    const newAccount = getActiveUnassignedAdobeAccount();
    
    if (!newAccount) {
        return NextResponse.json({ success: false, error: 'Нет свободных аккаунтов в пуле' }, { status: 400 });
    }
    
    // Assign new account
    updateAdobeAccountClient(newAccount.id, clientId);
    updateClientAdobeAccount(clientId, newAccount.id);
    
    // Unassign old account
    updateAdobeAccountClient(oldAccount.id, null);
    
    // Log replacement
    const { insertLog } = require('@/lib/db');
    const client = db.getClientById(clientId);
    const clientDisplay = client ? (client.telegram ? client.telegram : (client.email || `ID ${clientId}`)) : `ID ${clientId}`;
    insertLog('REPLACE_ACCOUNT', `Произведена замена аккаунта для клиента ${clientDisplay}. Снят: ${oldAccount.email}, Выдан: ${newAccount.email}`);
    
    // Notify client via Telegram
    try {
        const client = getClientById(clientId);
        if (client && client.telegram_chat_id) {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            if (token && newAccount) {
                const message = `🔄 *Ваш заблокированный аккаунт Adobe был заменен!*\n\n` + 
                              `Новый Email: \`${newAccount.email}\`\n\n` +
                              `Откройте меню бота или отправьте команду /adobe, чтобы получить доступ к новому аккаунту и кодам подтверждения.`;
                
                fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: client.telegram_chat_id,
                        text: message,
                        parse_mode: 'Markdown'
                    })
                }).catch(err => console.error("Failed to notify client on replace:", err));
            }
        }
    } catch (e) {
        console.error("Error notifying client about replacement:", e);
    }
    
    // [SECURITY] Return the new access_token, not numeric ID
    return NextResponse.json({ success: true, new_id: newAccount.access_token });
  } catch (error) {
    console.error('[ClientAdobe Replace] Error:', error);
    // [SECURITY] H-02: Don't leak error details
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
