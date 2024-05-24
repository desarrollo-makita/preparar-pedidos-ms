const express = require('express');
const router = express.Router();
const { prepararDataPedidos } = require('../controllers/prepararPedidosControllers');

router.post('/preparar-pedidos', prepararDataPedidos);

module.exports = router;
