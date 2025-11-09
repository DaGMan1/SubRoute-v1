import { Request, Response, NextFunction } from 'express';

export const checkUserId = (req: Request, res: Response, next: NextFunction) => {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ message: 'User ID is required in x-user-id header.' });
    }
    // Attach userId to the request object for easy access in route handlers
    (req as any).userId = userId;
    next();
};
