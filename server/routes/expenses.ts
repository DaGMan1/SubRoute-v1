import { Router, Request, Response } from 'express';
import db from '../db';
import { checkUserId } from '../utils/middleware';

const router = Router();
router.use(checkUserId);

// GET /api/expenses - Get all expenses for a user
router.get('/', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    try {
        const result = await db.query(
            'SELECT id, description, amount, category, date, trip_id as "tripId" FROM expenses WHERE user_id = $1 ORDER BY date DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// POST /api/expenses - Add a new expense
router.post('/', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { description, amount, category, date, tripId } = req.body;

    if (!description || !amount || !category || !date) {
        return res.status(400).json({ message: 'Description, amount, category, and date are required.' });
    }

    try {
        const result = await db.query(
            `INSERT INTO expenses (user_id, description, amount, category, date, trip_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, description, amount, category, date, trip_id as "tripId"`,
            [userId, description, amount, category, date, tripId || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// DELETE /api/expenses/:id - Delete an expense
router.delete('/:id', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const expenseId = req.params.id;
    try {
        const result = await db.query(
            'DELETE FROM expenses WHERE id = $1 AND user_id = $2',
            [expenseId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Expense not found or you do not have permission to delete it.' });
        }
        
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


export default router;
