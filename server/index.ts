import express, { Request, Response } from 'express';
import cors from 'cors';
import { initializeDatabase } from './db';
import authRoutes from './routes/auth';
import vehicleRoutes from './routes/vehicles';
import tripRoutes from './routes/trips';
import expenseRoutes from './routes/expenses';
import favoritePlaceRoutes from './routes/favoritePlaces';
// Fix: Import process to resolve TypeScript type error for process.exit
import process from 'process';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON bodies

// API Routes
app.get('/api', (req: Request, res: Response) => {
  res.json({ message: 'SubRoute API is running!' });
});

// Use component-specific routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/favorite-places', favoritePlaceRoutes);

const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();