
import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

// Middleware to check for user ID header
const checkUserId = (req: Request, res: Response, next: Function) => {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ message: 'User ID is required.' });
    }
    // Attach userId to the request object for easy access in route handlers
    (req as any).userId = userId;
    next();
};

// Apply middleware to all routes in this router
router.use(checkUserId);

// GET /api/vehicles - Get all vehicles for a user
router.get('/', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    try {
        const result = await db.query(
            'SELECT id, make, model, registration, is_primary as "isPrimary" FROM vehicles WHERE user_id = $1 ORDER BY created_at DESC', 
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// POST /api/vehicles - Add a new vehicle
router.post('/', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { make, model, registration } = req.body;

    if (!make || !model || !registration) {
        return res.status(400).json({ message: 'Make, model, and registration are required.' });
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Check how many vehicles the user already has
        const vehicleCountResult = await client.query('SELECT COUNT(*) FROM vehicles WHERE user_id = $1', [userId]);
        const vehicleCount = parseInt(vehicleCountResult.rows[0].count, 10);

        // First vehicle added is automatically primary
        const isPrimary = vehicleCount === 0;

        const result = await client.query(
            'INSERT INTO vehicles (user_id, make, model, registration, is_primary) VALUES ($1, $2, $3, $4, $5) RETURNING id, make, model, registration, is_primary as "isPrimary"',
            [userId, make, model, registration, isPrimary]
        );
        
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        await client.query('ROLLBACK');
        if (error.code === '23505') { // unique_violation
            return res.status(409).json({ message: 'This registration is already linked to another vehicle.' });
        }
        console.error('Error adding vehicle:', error);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        client.release();
    }
});

// PUT /api/vehicles/:id/primary - Set a vehicle as primary
router.put('/:id/primary', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const vehicleId = req.params.id;

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        
        // Set all other vehicles for this user to not be primary
        await client.query('UPDATE vehicles SET is_primary = FALSE WHERE user_id = $1', [userId]);

        // Set the specified vehicle as primary
        const result = await client.query(
            'UPDATE vehicles SET is_primary = TRUE WHERE id = $1 AND user_id = $2 RETURNING *', 
            [vehicleId, userId]
        );

        if (result.rows.length === 0) {
            throw new Error('Vehicle not found or does not belong to user.');
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Primary vehicle updated successfully.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error setting primary vehicle:', error);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        client.release();
    }
});

// DELETE /api/vehicles/:id - Delete a vehicle
router.delete('/:id', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const vehicleId = req.params.id;
    try {
        const result = await db.query(
            'DELETE FROM vehicles WHERE id = $1 AND user_id = $2', 
            [vehicleId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Vehicle not found or you do not have permission to delete it.' });
        }
        
        res.status(204).send(); // No content
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


export default router;
