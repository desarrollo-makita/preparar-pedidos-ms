const sql = require('mssql');
const logger = require('../config/logger.js');

async function connectToDatabase(databaseName) {
    const config = {
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        server: process.env.DB_SERVER,
        database: "Telecontrol",
        options: {
            encrypt: false
        }
    };

    try {
        await sql.connect(config);
    } catch (error) {
        logger.error(`Error al conectar a la base de datos ${error.message}`, );
        throw error;
    }
}

async function closeDatabaseConnection() {
    try {
        await sql.close();
        logger.info('Conexión a la base de datos cerrada');
    } catch (error) {
        logger.error(`Error al cerrar la conexión a la base de datos ${error.message}`);
        throw error;
    }
}

module.exports = { connectToDatabase, closeDatabaseConnection };
