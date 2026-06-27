import { NextResponse } from 'next/server';
import { getAdobeAccountById, getActiveUnassignedAdobeAccount, updateAdobeAccountClient, updateClientAdobeAccount } from '@/lib/db';

export async function POST(request, { params }) {
  const { id } = await params;
  
  if (!id) {
    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
  }

  try {
    const oldAccount = getAdobeAccountById(id);
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
    
    return NextResponse.json({ success: true, new_id: newAccount.id });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
