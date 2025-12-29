import type { User } from '../../types';
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
        const { name, email, password } = body;

        if (!name || !email || !password) {
            return new Response(JSON.stringify({ message: 'Name, email, and password are required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        if (password.length < 8) {
            return new Response(JSON.stringify({ message: 'Password must be at least 8 characters long.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        if (users.find(u => u.email === email)) {
            return new Response(JSON.stringify({ message: 'An account with this email already exists.' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }

        const newUser: User & { password?: string } = {
            id: userIdCounter.toString(),
            name,
            email,
            password, // Storing plain text for this simple in-memory setup.
        };
        users.push(newUser);
        incrementUserId();

        // Exclude password from the returned user object
        const { password: _, ...userToSend } = newUser;
        return new Response(JSON.stringify(userToSend), { status: 201, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('API Error in /register:', error);
        return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
