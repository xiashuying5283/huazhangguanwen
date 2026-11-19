import express from "express";
import cors from "cors";
import contentRouter from "./routes/content.js";
import aiRouter from "./routes/ai.js";

const app = express();
const port = Number(process.env.PORT || 9091);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1', contentRouter);
app.use('/api/v1', aiRouter);

app.listen({ port, host: process.env.SERVER_HOST }, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
