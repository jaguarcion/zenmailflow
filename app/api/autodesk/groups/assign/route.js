import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';

function getConfig() {
    const configJson = getSetting('autodesk_config');
    if (!configJson) return null;
    return JSON.parse(configJson);
}

export async function GET(request) {
    try {
        const url_obj = new URL(request.url);
        const groupId = url_obj.searchParams.get('groupId');
        
        const config = getConfig();
        if (!config || !config.authToken || !config.cookieString) {
            return NextResponse.json({ error: "Не настроена авторизация Autodesk" }, { status: 401 });
        }

        const { tenantId, authToken, cookieString } = config;
        const headers = {
            "accept": "application/json, text/plain, */*",
            "authorization": authToken,
            "cookie": cookieString,
            "origin": "https://manage.autodesk.com",
            "referer": "https://manage.autodesk.com/",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0"
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

        const config = getConfig();
        if (!config || !config.authToken || !config.cookieString) {
            return NextResponse.json({ error: "Не настроена авторизация Autodesk" }, { status: 401 });
        }

        const { tenantId, authToken, cookieString } = config;
        
        const url = `https://api.user-access.aum.autodesk.com/user-access/v2/tenants/${tenantId}/assignintent`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                "accept": "application/json, text/plain, */*",
                "authorization": authToken,
                "content-type": "application/json",
                "cookie": cookieString,
                "origin": "https://manage.autodesk.com",
                "referer": "https://manage.autodesk.com/",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0"
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
            const errText = await response.text().catch(() => '');
            throw new Error(`Autodesk API error: ${response.status} - ${errText}`);
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

        const config = getConfig();
        if (!config || !config.authToken || !config.cookieString) {
            return NextResponse.json({ error: "Не настроена авторизация Autodesk" }, { status: 401 });
        }

        const { tenantId, authToken, cookieString } = config;
        
        // Exact format the user provided in their logs:
        const url = `https://api.user-access.aum.autodesk.com/user-access/v2/tenants/${tenantId}/assignintent?subjectId=${groupId}&subscriberContextId=urn:adsk.aum:prd:tenant.oxygenId:${tenantId}&poolType=${poolType}&poolKey=${poolKey}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                "accept": "application/json, text/plain, */*",
                "authorization": authToken,
                "cookie": cookieString,
                "origin": "https://manage.autodesk.com",
                "referer": "https://manage.autodesk.com/",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0"
            }
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Autodesk API error: ${response.status} - ${errText}`);
        }

        return NextResponse.json({ status: "success" });
    } catch (error) {
        console.error("Assign DELETE error:", error);
        return NextResponse.json({ error: error.message || "Failed to remove program" }, { status: 500 });
    }
}
