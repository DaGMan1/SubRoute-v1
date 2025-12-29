import { users, userIdCounter, incrementUserId } from './db';

export default async function handler(request: Request) {
     if (request.method !== 'POST') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    
    try {
        const body = await request.json();
        const { email, name } = body;
         if (!email || !name) {
            return new Response(JSON.stringify({ message: 'OAuth provider information is incomplete.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        let user = users.find(u => u.email === email);
        
        // If user doesn't exist, create a new one.
        if (!user) {
            user = {
                id: userIdCounter.toString(),
                name,
                email,
                // No password for OAuth users
            };
            users.push(user);
            incrementUserId();
        }
        
         return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('API Error in /oauth:', error);
        return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
