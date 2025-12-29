import { users } from './db';

export default async function handler(request: Request) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return new Response(JSON.stringify({ message: 'Email and password are required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const user = users.find(u => u.email === email);
        if (!user || user.password !== password) {
            return new Response(JSON.stringify({ message: 'Invalid credentials.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        // Exclude password from the returned user object
        const { password: _, ...userToSend } = user;
        return new Response(JSON.stringify(userToSend), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('API Error in /login:', error);
        return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
