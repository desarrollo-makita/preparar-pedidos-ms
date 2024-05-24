const { prepararPedidos } = require('../controllers/obtenerPedidosControllers.js');
const mock = require('../config/mock.js');
const axios = require('axios');

jest.mock('axios');
jest.mock('../config/logger');

describe('prepararPedidos', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('se realiza el proceso exitoso 200', async () => {
    // Mockear la respuesta de obtenerPedidos
    axios.get.mockResolvedValueOnce(mock.obtenerPedidosService);

    // Simular objetos req y res
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await obtenerPedidos(req, res);
       
    // Verificar que el estado y la respuesta JSON sean correctos
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      itemList: expect.any(Array),
      pedidos: expect.any(Array),
    }));
    
  });

});
