import { NextResponse } from 'next/server';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import db from '@/lib/db';
import crypto from 'crypto';

// Disable Edge runtime as we rely on native Node.js and sqlite3
// export const runtime = 'nodejs';

async function processAutodeskTask(taskId, users, config, token) {
    let localUsers = [...users];
    
    // While there are users not successfully added
    while (localUsers.some(u => u.status !== 'success')) {
        let successCount = localUsers.filter(u => u.status === 'success').length;
        let errorCount = localUsers.filter(u => u.status === 'error').length;
        
        for (let i = 0; i < localUsers.length; i++) {
            const user = localUsers[i];
            if (user.status === 'success') continue;
            
            try {
                // In a real background worker hitting an internal Next.js API route isn't ideal 
                // due to absolute URLs, but since we are on the server, we can just call the external API directly here.
                // However, to keep it simple and reuse the route logic, we could use fetch to localhost 
                // OR we can just implement the Autodesk API call directly here to avoid loopback issues.
                // I will implement it directly here to be robust.

                const apiUrl = `https://api.user-access.aum.autodesk.com/user-access/v1/tenants/${config.tenantId}/users`;
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "authorization": config.authToken,
                        "content-type": "application/json",
                        "cookie": config.cookieString,
                        "origin": "https://manage.autodesk.com",
                        "referer": "https://manage.autodesk.com/",
                        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0"
                    },
                    body: JSON.stringify({
                        "firstName": user.firstName || '',
                        "lastName": user.lastName || '',
                        "emailId": user.email,
                        "invitedBy": config.invitedBy,
                        "hideMarketingOptIn": true
                    })
                });
                
                if (response.status === 429) {
                    user.status = 'error';
                    await new Promise(r => setTimeout(r, 5000));
                } else {
                    const text = await response.text();
                    let data = {};
                    if (text) {
                        try { data = JSON.parse(text); } catch (e) {}
                    }
                    
                    if (response.ok) {
                        user.status = 'success';
                        successCount++;
                        
                        // Assign to group if provided
                        if (config.groupId && config.groupId.trim() !== '' && data.id) {
                            try {
                                const groupUrl = `https://api.user-access.aum.autodesk.com/user-access/v1/teams/urn:adsk.aum:prd:tenant.oxygenId:${config.tenantId}/groups/${config.groupId.trim()}/users/${data.id}`;
                                await fetch(groupUrl, {
                                    method: 'POST',
                                    headers: {
                                        "accept": "application/json, text/plain, */*",
                                        "authorization": config.authToken,
                                        "content-type": "application/json",
                                        "cookie": config.cookieString,
                                        "origin": "https://manage.autodesk.com",
                                        "referer": "https://manage.autodesk.com/"
                                    },
                                    body: JSON.stringify({})
                                });
                            } catch (err) {
                                console.error("Group assignment error", err);
                            }
                        }
                    } else {
                        user.status = 'error';
                    }
                }
            } catch (err) {
                user.status = 'error';
                console.error("Autodesk API fetch error", err);
            }
            
            errorCount = localUsers.filter(u => u.status === 'error').length;
            
            // Update DB progress
            try {
                db.prepare('UPDATE autodesk_tasks SET success = ?, error = ? WHERE id = ?')
                  .run(successCount, errorCount, taskId);
            } catch (e) {
                console.error("DB update error", e);
            }
            
            // Delay between requests
            await new Promise(r => setTimeout(r, 1000));
        }
        
        // Wait before retrying errors
        if (localUsers.some(u => u.status !== 'success')) {
            await new Promise(r => setTimeout(r, 5000));
        }
    }
    
    // Finished successfully
    try {
        db.prepare('UPDATE autodesk_tasks SET status = ?, items_json = ? WHERE id = ?')
          .run('completed', JSON.stringify(localUsers), taskId);
    } catch (e) {
        console.error("DB finalize error", e);
    }
}

export async function POST(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ip = request.headers.get('x-forwarded-for') || request.ip || 'unknown-ip';
    const isAllowed = await checkRateLimit(ip, 30, 60); 
    if (!isAllowed) {
        return NextResponse.json({ success: false, error: 'Too Many Requests' }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { config, users } = body;
        
        if (!config || !config.authToken || !config.cookieString || !users || !Array.isArray(users)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }
        
        const taskId = crypto.randomUUID();
        const total = users.length;
        
        db.prepare(`
            INSERT INTO autodesk_tasks (id, total, status)
            VALUES (?, ?, 'processing')
        `).run(taskId, total);
        
        // Start background worker (do not await)
        // Extract token if needed, but not required if we call Autodesk API directly
        processAutodeskTask(taskId, users, config, null).catch(err => {
            console.error("Error in background task", err);
            try {
                db.prepare('UPDATE autodesk_tasks SET status = ? WHERE id = ?').run('error', taskId);
            } catch (e) {}
        });
        
        return NextResponse.json({ success: true, taskId });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
