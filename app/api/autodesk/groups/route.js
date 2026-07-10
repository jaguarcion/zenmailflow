import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';

function getConfig() {
    const configJson = getSetting('autodesk_config');
    if (!configJson) return null;
    return JSON.parse(configJson);
}

export async function GET(request) {
    try {
        const config = getConfig();
        if (!config || !config.authToken || !config.cookieString) {
            return NextResponse.json({ error: "Не настроена авторизация Autodesk" }, { status: 401 });
        }

        const { tenantId, authToken, cookieString } = config;
        
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
        const config = getConfig();
        if (!config || !config.authToken || !config.cookieString) {
            return NextResponse.json({ error: "Не настроена авторизация Autodesk" }, { status: 401 });
        }

        const { tenantId, authToken, cookieString } = config;
        
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

        const config = getConfig();
        if (!config || !config.authToken || !config.cookieString) {
            return NextResponse.json({ error: "Не настроена авторизация Autodesk" }, { status: 401 });
        }

        const { tenantId, authToken, cookieString } = config;
        
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
