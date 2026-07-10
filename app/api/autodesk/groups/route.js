import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'app_settings.json');

async function getSettings() {
    try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return { autodesk: {} };
    }
}

export async function GET(request) {
    try {
        const settings = await getSettings();
        const { authToken, cookieString, selectedTenantId } = settings.autodesk || {};

        if (!authToken || !cookieString) {
            return NextResponse.json({ error: "Не настроена авторизация Autodesk" }, { status: 401 });
        }

        const tenantId = selectedTenantId || "63238795"; // Default tenant
        
        // GET /v1/tenants/{tenantId}/groups
        const url = `https://api.user-access.aum.autodesk.com/user-access/v1/tenants/${tenantId}/groups?limit=1000&offset=0&filter[groupType]=basic&filter[groupType]=synced&sort=%2Bname&includeAssignments=true`;

        const response = await fetch(url, {
            headers: {
                "Authorization": authToken,
                "Cookie": cookieString,
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Autodesk API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json({ status: "success", data });
    } catch (error) {
        console.error("Groups fetch error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch groups" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { name } = await request.json();
        const settings = await getSettings();
        const { authToken, cookieString, selectedTenantId } = settings.autodesk || {};

        if (!authToken || !cookieString) {
            return NextResponse.json({ error: "Не настроена авторизация Autodesk" }, { status: 401 });
        }

        const tenantId = selectedTenantId || "63238795";
        
        const url = `https://api.user-access.aum.autodesk.com/user-access/v2/tenants/${tenantId}/groups`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                "Authorization": authToken,
                "Cookie": cookieString,
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                type: "basic"
            })
        });

        if (!response.ok) {
            throw new Error(`Autodesk API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json({ status: "success", data });
    } catch (error) {
        console.error("Create group error:", error);
        return NextResponse.json({ error: error.message || "Failed to create group" }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const url_obj = new URL(request.url);
        const groupId = url_obj.searchParams.get('groupId');
        
        if (!groupId) {
            return NextResponse.json({ error: "Group ID is required" }, { status: 400 });
        }

        const settings = await getSettings();
        const { authToken, cookieString, selectedTenantId } = settings.autodesk || {};

        if (!authToken || !cookieString) {
            return NextResponse.json({ error: "Не настроена авторизация Autodesk" }, { status: 401 });
        }

        const tenantId = selectedTenantId || "63238795";
        
        const url = `https://api.user-access.aum.autodesk.com/user-access/v1/tenants/${tenantId}/groups/${groupId}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                "Authorization": authToken,
                "Cookie": cookieString,
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Autodesk API error: ${response.status}`);
        }

        return NextResponse.json({ status: "success" });
    } catch (error) {
        console.error("Delete group error:", error);
        return NextResponse.json({ error: error.message || "Failed to delete group" }, { status: 500 });
    }
}
