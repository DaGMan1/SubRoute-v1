import { Router, Request, Response } from 'express';
import db from '../db';
import bcrypt from 'bcrypt';

const router = Router();
const saltRounds = 10; // Standard for bcrypt hashing

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
    const { name, email, password, abn } = req.body;

    // Basic validation
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    try {
        // Check if user already exists
        const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert new user into the database
        const newUserQuery = `
            INSERT INTO users (name, email, password_hash, abn, auth_provider)
            VALUES ($1, $2, $3, $4, 'local')
            RETURNING id, name, email, created_at;
        `;
        const newUser = await db.query(newUserQuery, [name, email, hashedPassword, abn || null]);

        res.status(201).json(newUser.rows[0]);

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || user.auth_provider !== 'local' || !user.password_hash) {
            return res.status(401).json({ message: 'Invalid credentials or sign-in method.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        // Don't send the password hash back to the client
        const { password_hash, ...userToSend } = user;

        res.status(200).json(userToSend);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error during login.' });
    }
});

// POST /api/auth/oauth
router.post('/oauth', async (req: Request, res: Response) => {
    const { email, name, provider, providerId } = req.body;

    if (!email || !name || !provider || !providerId) {
        return res.status(400).json({ message: 'OAuth provider information is incomplete.' });
    }

    try {
        // 1. Check if user exists with this provider ID
        let userResult = await db.query('SELECT * FROM users WHERE provider_id = $1 AND auth_provider = $2', [providerId, provider]);

        if (userResult.rows.length > 0) {
            // User found, log them in
            const { password_hash, ...userToSend } = userResult.rows[0];
            return res.status(200).json(userToSend);
        }

        // 2. If not, check if an account with this email already exists (e.g., created with password)
        const emailCheckResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (emailCheckResult.rows.length > 0) {
            return res.status(409).json({ message: 'An account with this email already exists. Please log in using your original method.' });
        }

        // 3. Create a new user
        const newUserQuery = `
            INSERT INTO users (name, email, auth_provider, provider_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, email, created_at;
        `;
        const newUser = await db.query(newUserQuery, [name, email, provider, providerId]);

        res.status(201).json(newUser.rows[0]);

    } catch (error) {
        console.error('OAuth error:', error);
        res.status(500).json({ message: 'Internal server error during OAuth process.' });
    }
});


export default router;