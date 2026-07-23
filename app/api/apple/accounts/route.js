import { NextResponse } from 'next/server';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { getAllAppleAccounts } = require('../../../../lib/db.js');

export async function GET() {
    try {
        const accounts = getAllAppleAccounts();
        return NextResponse.json({ success: true, data: accounts });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
