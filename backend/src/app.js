const path = require('path');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const backupRoutes = require('./routes/backupRoutes');
const productRoutes = require('./routes/productRoutes');
const reportRoutes = require('./routes/reportRoutes');
const saleRoutes = require('./routes/saleRoutes');
const userRoutes = require('./routes/userRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Origens aceitas: o Vite em desenvolvimento e o próprio backend, que serve
// o frontend quando roda dentro do Electron. Requisições sem Origin
// (Insomnia, curl) também passam.
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origem não permitida pelo CORS.'));
    },
  })
);
app.use(express.json({ limit: '2mb' }));

// Toda a API fica sob /api para não colidir com as rotas do React
// (ex: /products é uma tela e também um endpoint).
const api = express.Router();
api.get('/health', (req, res) => res.json({ status: 'ok' }));
api.use('/auth', authRoutes);
api.use(backupRoutes);
api.use(productRoutes);
api.use(reportRoutes);
api.use(saleRoutes);
api.use(userRoutes);
api.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.', code: 'NOT_FOUND' });
});

app.use('/api', api);

// No Electron o backend também serve o build do React (FRONTEND_DIST_PATH).
if (process.env.FRONTEND_DIST_PATH) {
  const frontendDistPath = path.resolve(process.env.FRONTEND_DIST_PATH);
  app.use(express.static(frontendDistPath));

  // Qualquer outro GET devolve o index.html para o React Router resolver a
  // rota no navegador (ex: ao apertar F5 em /sales).
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    return res.sendFile(path.join(frontendDistPath, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

app.use(errorHandler);

module.exports = app;
