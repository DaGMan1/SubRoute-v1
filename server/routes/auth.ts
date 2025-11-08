
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
            INSERT INTO users (name, email, password_hash, abn)
            VALUES ($1, $2, $3, $4)
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

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
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


export default router;
