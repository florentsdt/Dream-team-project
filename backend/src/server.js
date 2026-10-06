import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import companiesRouter from './routes/companies.js';
import categoriesRouter from './routes/categories.js';
import adsRouter from './routes/ads.js';
import peopleRouter from './routes/people.js';
import applicationsRouter from './routes/applications.js';
import { errorHandler, notFound } from './lib/errors.js';

const app = express();

app.use(cors()); // autorise le front (autre port) à appeler l'API
app.use(express.json());
app.set('json spaces', 2);

app.get('/', (req, res) => res.json({ name: 'DT Job API', status: 'ok' }));

app.use('/companies', companiesRouter);
app.use('/categories', categoriesRouter);
app.use('/ads', adsRouter);
app.use('/people', peopleRouter);
app.use('/applications', applicationsRouter);

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`DT Job API : http://localhost:${port}`));
