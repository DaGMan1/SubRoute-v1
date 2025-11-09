import { Router, Request, Response } from 'express';
import db from '../db';
import { checkUserId } from '../utils/middleware';

const router = Router();
router.use(checkUserId);

// GET /api/trips - Get all trips for a user
router.get('/', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    try {
        const result = await db.query(
            `SELECT 
                t.id, 
                t.start_time as "startTime", 
                t.end_time as "endTime",
                t.start_odometer as "startOdometer",
                t.end_odometer as "endOdometer",
                t.distance,
                t.purpose,
                t.notes,
                t.status,
                t.vehicle_id as "vehicleId",
                v.make || ' ' || v.model as "vehicleInfo"
            FROM trips t
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            WHERE t.user_id = $1 ORDER BY t.start_time DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// POST /api/trips - Start a new trip
router.post('/', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { startOdometer, vehicleId } = req.body;

    if (!startOdometer || !vehicleId) {
        return res.status(400).json({ message: 'startOdometer and vehicleId are required.' });
    }

    try {
        // Check if there's already an active trip for this user
        const activeTripCheck = await db.query(
            "SELECT id FROM trips WHERE user_id = $1 AND status = 'active'",
            [userId]
        );
        if (activeTripCheck.rows.length > 0) {
            return res.status(409).json({ message: 'An active trip is already in progress. Please end it before starting a new one.' });
        }

        const result = await db.query(
            `INSERT INTO trips (user_id, vehicle_id, start_time, start_odometer, status) 
             VALUES ($1, $2, NOW(), $3, 'active') 
             RETURNING id, start_time as "startTime", start_odometer as "startOdometer", status, vehicle_id as "vehicleId"`,
            [userId, vehicleId, startOdometer]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error starting trip:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// PUT /api/trips/:id - End a trip
router.put('/:id', async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const tripId = req.params.id;
    const { endOdometer, purpose, notes } = req.body;

    if (!endOdometer || !purpose) {
        return res.status(400).json({ message: 'endOdometer and purpose are required.' });
    }

    try {
        const tripResult = await db.query(
            "SELECT start_odometer FROM trips WHERE id = $1 AND user_id = $2 AND status = 'active'",
            [tripId, userId]
        );

        if (tripResult.rows.length === 0) {
            return res.status(404).json({ message: 'Active trip not found or does not belong to user.' });
        }

        const startOdometer = tripResult.rows[0].start_odometer;
        if (endOdometer <= startOdometer) {
            return res.status(400).json({ message: 'End odometer must be greater than start odometer.' });
        }
        const distance = endOdometer - startOdometer;

        const result = await db.query(
            `UPDATE trips 
             SET 
                end_time = NOW(), 
                end_odometer = $1, 
                purpose = $2, 
                notes = $3, 
                status = 'completed',
                distance = $4
             WHERE id = $5 AND user_id = $6
             RETURNING *`,
            [endOdometer, purpose, notes || null, distance, tripId, userId]
        );
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error ending trip:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

export default router;
