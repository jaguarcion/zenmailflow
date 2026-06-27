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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
  }

  try {
    deleteAdobeAccount(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, client_id, action } = body;

    if (action === 'assign') {
      updateAdobeAccountClient(id, client_id);
      if (client_id) {
        updateClientAdobeAccount(client_id, id);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
