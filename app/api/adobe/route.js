import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getAllAdobeAccounts, deleteAdobeAccount, updateAdobeAccountClient, updateClientAdobeAccount } from '@/lib/db';

export async function GET(request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const accounts = getAllAdobeAccounts();
    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    console.error('[Adobe GET]', error);
    // [SECURITY] H-02: Don't leak error details
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  // [SECURITY] M-01: Validate ID is a number
  if (!id || isNaN(parseInt(id))) {
    return NextResponse.json({ success: false, error: 'Valid numeric ID is required' }, { status: 400 });
  }

  try {
    const db = require('@/lib/db');
    const account = db.getAdobeAccountById(parseInt(id));
    if (account) {
        db.insertLog('DELETE_ACCOUNT', `Удален аккаунт ${account.email} из пула`);
    }
    deleteAdobeAccount(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Adobe DELETE]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, client_id, action } = body;

    // [SECURITY] M-01: Validate input types
    if (!id || !action || typeof action !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (action === 'assign') {
      const db = require('@/lib/db');
      const account = db.getAdobeAccountById(id);
      
      updateAdobeAccountClient(id, client_id === -1 ? -1 : (client_id || null));
      
      if (client_id && client_id !== -1) {
        updateClientAdobeAccount(client_id, id);
        const client = db.getClientById(client_id);
        db.insertLog('ASSIGN_ACCOUNT', `Назначен аккаунт ${account?.email} клиенту ${client?.email || `ID ${client_id}`}`);
        
        // Notify client via Telegram
        try {
            const client = db.getClientById(client_id);
            if (client && client.telegram_chat_id) {
                const token = process.env.TELEGRAM_BOT_TOKEN;
                if (token && account) {
                    const message = `✅ *Вам назначен новый аккаунт Adobe!*\n\n` + 
                                  `📧 Email: \`${account.email}\`\n\n` +
                                  `Откройте меню бота или отправьте команду /adobe, чтобы получить доступ к аккаунту и кодам подтверждения.`;
                    
                    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: client.telegram_chat_id,
                            text: message,
                            parse_mode: 'Markdown'
                        })
                    }).catch(err => console.error("Failed to notify client:", err));
                }
            }
        } catch (e) {
            console.error("Error notifying client about assignment:", e);
        }

      } else if (!client_id && account && account.assigned_client_id) {
        updateClientAdobeAccount(account.assigned_client_id, null);
        const client = db.getClientById(account.assigned_client_id);
        db.insertLog('UNASSIGN_ACCOUNT', `Отвязан аккаунт ${account?.email} от клиента ${client?.email || `ID ${account.assigned_client_id}`}`);
      }
      return NextResponse.json({ success: true });
    }
    
    if (action === 'comment') {
      const { comment } = body;
      const db = require('@/lib/db');
      db.updateAdobeAccountComment(id, comment || null);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Adobe PATCH]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
