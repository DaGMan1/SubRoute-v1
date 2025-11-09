import { Router, Request, Response } from 'express';
import db from '../db';
import { checkUserId } from '../utils/middleware';

const router = Router();
router.use(checkUserId);

// GET /api/favorite-places
router.get('/', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    try {
        const result = await db.query(
            'SELECT id, name, address, is_home as "isHome" FROM favorite_places WHERE user_id = $1 ORDER BY created_at ASC',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching favorite places:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// POST /api/favorite-places
router.post('/', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { name, address } = req.body;

    if (!name || !address) {
        return res.status(400).json({ message: 'Name and address are required.' });
    }
    
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const placeCountResult = await client.query('SELECT COUNT(*) FROM favorite_places WHERE user_id = $1', [userId]);
        const isHome = parseInt(placeCountResult.rows[0].count, 10) === 0;

        const result = await client.query(
            `INSERT INTO favorite_places (user_id, name, address, is_home) VALUES ($1, $2, $3, $4)
             RETURNING id, name, address, is_home as "isHome"`,
            [userId, name, address, isHome]
        );
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding favorite place:', error);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        client.release();
    }
});

// PUT /api/favorite-places/:id/home - Set as home
router.put('/:id/home', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const placeId = req.params.id;

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        await client.query('UPDATE favorite_places SET is_home = FALSE WHERE user_id = $1', [userId]);
        const result = await client.query(
            'UPDATE favorite_places SET is_home = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
            [placeId, userId]
        );
        if (result.rows.length === 0) {
            throw new Error('Favorite place not found or does not belong to user.');
        }
        await client.query('COMMIT');
        res.status(200).json({ message: 'Home place updated successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error setting home place:', error);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        client.release();
    }
});


// DELETE /api/favorite-places/:id
router.delete('/:id', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const placeId = req.params.id;
    try {
        const result = await db.query(
            'DELETE FROM favorite_places WHERE id = $1 AND user_id = $2',
            [placeId, userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Favorite place not found or you do not have permission to delete it.' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting favorite place:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

export default router;
