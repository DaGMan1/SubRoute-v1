import express, { Request, Response } from 'express';
import authRoutes from './routes/auth';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware to parse JSON bodies
app.use(express.json());

// API Routes
app.get('/api', (req: Request, res: Response) => {
  res.json({ message: 'SubRoute API is running!' });
});

// Use component-specific routes
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
