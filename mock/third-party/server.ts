import express from 'express';
import routes from './routes';

const app = express();
app.use(express.json());

app.use('/api', routes);

const PORT = 4000;

app.listen(PORT, () => {
  console.log(`🧪 Dummy Third-Party API running at http://localhost:${PORT}`);
});
