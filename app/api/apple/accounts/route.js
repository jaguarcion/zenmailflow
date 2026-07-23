import { NextResponse } from 'next/server';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('../../../../lib/apple/db.js');

export async function GET() {
    try {
        const accounts = await db.getAllAccounts();
        return NextResponse.json({ success: true, data: accounts });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
