const express = require('express');
const { connectToDatabase } = require('./config/database');
const routes = require('./routes/routes');
require('dotenv').config();
const logger = require('./config/logger.js');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// Middleware para habilitar CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Permite cualquier origen
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.use('/ms', routes);

// Iniciar el servidor después de la conexión a la base de datos
connectToDatabase().then(() => {
    app.listen(PORT, () => {
        logger.info(`Servidor escuchando en el puerto ${PORT}`);
    });
}).catch(error => {
    logger.error(`Error al iniciar el servidor ${error}`);
    process.exit(1); // Termina el proceso con un código de error
});
