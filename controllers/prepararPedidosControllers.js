const axios = require('axios');
const sql = require('mssql');
const logger = require('../config/logger.js');
const { connectToDatabase, closeDatabaseConnection } = require('../config/database.js');
const moment = require('moment');


/**
 * Preparamos lista de pedidos para devolver solo con entiadad cliente maikita
 * @param {*} osList
 * @param {*} pedidosList  
 * @returns 
 */
async function prepararDataPedidos(req, res) {
    
    logger.info(`Iniciamos la funcion prepararDataPedidos ${JSON.stringify(req.body)}`);
    
    let osList = req.body.osList; 
    let pedidosList= req.body.pedidosList;
    
    let arrayPedidosFormated = [];
    let arrayPedidosData = [];
    let arrayPedidosRepetidos = [];
    try {
        let dataOrdenServicio = await dataValidaCliente(osList);// Dejamos solo las OS que tienen los servicio tecnicos de makita
        for (let i = 0; i < pedidosList.length; i++) {
            for (let j = 0; j < dataOrdenServicio.length; j++) {
                if (pedidosList[i].pedido === dataOrdenServicio[j].idPedido) {
                    
                    let objetoComparacion = { ...pedidosList[i] };
                    objetoComparacion.codigo_posto = dataOrdenServicio[j].codigo_posto;
                    objetoComparacion.informeTecnico = dataOrdenServicio[j].defeito_reclamado;
                    objetoComparacion.modelo = dataOrdenServicio[j].referencia;
                    objetoComparacion.serie = dataOrdenServicio[j].serie;
                    objetoComparacion.nombreServicioTecnico = dataOrdenServicio[j].nome;
                    objetoComparacion.direccion = dataOrdenServicio[j].direccion;
                    objetoComparacion.fechaCompra = dataOrdenServicio[j].data_nf;
                    objetoComparacion.distribuidor = dataOrdenServicio[j].revenda;
                    objetoComparacion.numeroDocumento = dataOrdenServicio[j].nota_fiscal;
                    objetoComparacion.data = dataOrdenServicio[j].data_digitacao;

                    arrayPedidosFormated.push(objetoComparacion);
                }
            }
        }
       
        for (const objeto of arrayPedidosFormated) {
            let os_valor = objeto.itens[0].os;
            objeto.os = os_valor;

            // microservicio validar-pedido-ms
           
            logger.info(`Ejecuta microservcio validar-pedido-ms` ); 
            const validaPedido = await axios.post('http://172.16.1.206:4008/ms/validar-pedidos', objeto );
            logger.debug(`Respuesta de microservicio validar-pedido-ms ${JSON.stringify(validaPedido)}`);
            
            
            logger.info(`Valida data pedido`);
            if (validaPedido.length > 0) {
                
                arrayPedidosRepetidos.push(objeto);
            } else {
               
                arrayPedidosData.push(objeto);
            }
        }

        logger.info(`Pedidos Repetidos, ${(arrayPedidosRepetidos.length )}`);
        logger.info(`Pedidos para insertar , ${(arrayPedidosData.length)}` );
        logger.info(`Fin de la funcion prepararDataPedidos`);
        

        res.status(200).json(arrayPedidosData);
        
    
} catch (error) {
         // Manejamos cualquier error ocurrido durante el proceso
         logger.error(`Error en prepararPedidos: ${error.message}`);
         res.status(500).json({ error: `Error en el servidor [preparar-pedidos-ms] :  ${error.message}`  });
       
    }
}


/**
 * Enviamos Ordenes de servicio para verificar si servicio tecnico es usuario makita
 * @param {*} osArray 
 * @returns 
 */
async function dataValidaCliente(osArray) {
    
    logger.info(`Iniciamos la funcion dataValidaCliente`);
    let newArray = [];
    let newData;

    try {

        for (const os of osArray) {
            const codigoPosto = os.codigo_posto.trim();
            
            const data = {
                tabla : process.env.ENTIDAD_TABLE,
                entidad :  codigoPosto
            }
            
            //microservicio validar-cliente-ms
            logger.info(`Ejecuta microservcio validar-cliente-ms`); 
            const resultadoConsulta = await axios.post('http://172.16.1.206:4006/ms/validar-cliente', data);
            logger.debug(`Respuesta microservcio validar-cliente-ms ${JSON.stringify(resultadoConsulta.data)}`); 

            // recorremos las ordenes de servicio si el length es mayo a 0 es por que el clienteexiste en makita.
            if (resultadoConsulta.data.length > 0) {
                
                for (dataServicioTecnico of resultadoConsulta.data) {
                   os.direccion = dataServicioTecnico.Direccion;
                }
                newArray.push(os);

            }
        }
        if (newArray.length === 0) {
            logger.info( `La data a procesar no es un servicio tecnico de makita`);
            
        }
        
        const data = newArray;
       //microservicio validar-orden-ms
       logger.info(`Ejecuta microservcio validar-orden-ms`); 
       const resultadoValidarOrden = await axios.post('http://172.16.1.206:4007/ms/validar-orden', data);

        logger.info(`Fin de la funcion dataValidaCliente`);
        return newArray;

    } catch (error) {
        logger.error(`Error en prepararPedidos: ${error.message}`);
        throw error; // Propaga el error a la función principal
    }

   
}


module.exports = {
    dataValidaCliente, prepararDataPedidos
};
