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
      } else if (!client_id && account && account.assigned_client_id) {
        updateClientAdobeAccount(account.assigned_client_id, null);
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
