
import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import vehicleRoutes from './routes/vehicles';

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
