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
        const url_obj = new URL(request.url);
        const groupId = url_obj.searchParams.get('groupId');
        
        const settings = await getSettings();
        const { authToken, cookieString, selectedTenantId } = settings.autodesk || {};

        if (!authToken || !cookieString) {
            return NextResponse.json({ error: "Не настроена авторизация Autodesk" }, { status: 401 });
        }

        const tenantId = selectedTenantId || "63238795";
        const headers = {
            "Authorization": authToken,
            "Cookie": cookieString,
            "Accept": "application/json"
        };
        
        // 1. Fetch available seatpools (programs)
        const seatpoolsUrl = `https://api.user-access.aum.autodesk.com/user-access/v2/teams/urn:adsk.aum:prd:tenant.oxygenId:${tenantId}/seatpools?includeServicePlans=true`;
        const seatpoolsRes = await fetch(seatpoolsUrl, { headers });
        let seatpools = [];
        if (seatpoolsRes.ok) {
            const spData = await seatpoolsRes.json();
            seatpools = spData.results || spData; // Handle both formats just in case
        }

        // 2. If groupId is provided, fetch assigned programs
        let assignments = [];
        if (groupId) {
            const assignUrl = `https://api.user-access.aum.autodesk.com/user-access/v4/tenants/${tenantId}/assignintent?filter[subjectIds]=${groupId}&includeServicePlans=false&includeEpsPool=true`;
            const assignRes = await fetch(assignUrl, { headers });
            if (assignRes.ok) {
                const asData = await assignRes.json();
                assignments = asData.results || asData;
            }
        }

        return NextResponse.json({ 
            status: "success", 
            data: { seatpools, assignments } 
        });
    } catch (error) {
        console.error("Assign GET error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch assignments" }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const { groupId, poolKey, poolType } = await request.json();
        
        if (!groupId || !poolKey) {
            return NextResponse.json({ error: "groupId and poolKey are required" }, { status: 400 });
        }

        const settings = await getSettings();
        const { authToken, cookieString, selectedTenantId } = settings.autodesk || {};

        if (!authToken || !cookieString) {
            return NextResponse.json({ error: "Не настроена авторизация Autodesk" }, { status: 401 });
        }

        const tenantId = selectedTenantId || "63238795";
        
        const url = `https://api.user-access.aum.autodesk.com/user-access/v2/tenants/${tenantId}/assignintent`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                "Authorization": authToken,
                "Cookie": cookieString,
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                subjectId: groupId,
                subjectType: "group",
                subscriberContextId: `urn:adsk.aum:prd:tenant.oxygenId:${tenantId}`,
                pool: {
                    type: poolType || "EP",
                    key: poolKey
                },
                features: {}
            })
        });

        if (!response.ok) {
            throw new Error(`Autodesk API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json({ status: "success", data });
    } catch (error) {
        console.error("Assign PUT error:", error);
        return NextResponse.json({ error: error.message || "Failed to assign program" }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const url_obj = new URL(request.url);
        const groupId = url_obj.searchParams.get('groupId');
        const poolKey = url_obj.searchParams.get('poolKey');
        const poolType = url_obj.searchParams.get('poolType') || 'EP';
        
        if (!groupId || !poolKey) {
            return NextResponse.json({ error: "groupId and poolKey are required" }, { status: 400 });
        }

        const settings = await getSettings();
        const { authToken, cookieString, selectedTenantId } = settings.autodesk || {};

        if (!authToken || !cookieString) {
            return NextResponse.json({ error: "Не настроена авторизация Autodesk" }, { status: 401 });
        }

        const tenantId = selectedTenantId || "63238795";
        
        // Exact format the user provided in their logs:
        const url = `https://api.user-access.aum.autodesk.com/user-access/v2/tenants/${tenantId}/assignintent?subjectId=${groupId}&subscriberContextId=urn:adsk.aum:prd:tenant.oxygenId:${tenantId}&poolType=${poolType}&poolKey=${poolKey}`;

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
        console.error("Assign DELETE error:", error);
        return NextResponse.json({ error: error.message || "Failed to remove program" }, { status: 500 });
    }
}
