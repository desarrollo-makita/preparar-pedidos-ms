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
        console.log("dataOrdenServicio---------->", dataOrdenServicio);
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

            // LLAMMAOS AL MICROSERVICIO VALIDAR-PEDIDOS-MS
            let validaPedido = await validaDataPedidos(objeto);// revisa que el pedido no se haya ingresqado anteriormente
            logger.info(`Valida data pedido ${JSON.stringify(validaPedido)}`);
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
            
            // Obtener data de tabla entidad para validar cliente------> cambiar por MICROSERVICIO valida-entidad-ms
            // let resultadoConsulta = await validarCliente(process.env.ENTIDAD_TABLE, codigoPosto);

            //microservicio validar-cliente-ms
            logger.info(`Ejecuta microservcio validar-cliente-ms`); 
            const resultadoConsulta = await axios.post('http://172.16.1.206:4006/ms/validar-cliente', data);
            console.log("este es el resuñltado de la consulta" , resultadoConsulta.data);
            
            //logger.debug(`Respuesta microservcio validar-cliente-ms ${JSON.stringify(osList.data)}`); 

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
        
        // MICROSERVICIO validar-orden-ms se debe cambiar cuando este listo
        await validarDatos(newArray);// revisamos si la data que tenemos para ingresar se encuentra ingresada en la BD telecontrol

        logger.info(`Fin de la funcion dataValidaCliente`);
        return newArray;

    } catch (error) {
        logger.error(`Error en prepararPedidos: ${error.message}`);
        throw error; // Propaga el error a la función principal
    }

   
}

/**
 * Consultamos base de datos telecontrol(makita)
 * @param {*} objPedido 
 * @returns 
 */
async function validaDataPedidos(objPedido) {

    try {
        console.log("objpedido",objPedido);
        await connectToDatabase('Telecontrol');

        const consulta = `SELECT * FROM Telecontrol.dbo.Pedidos where ID_Pedido = '${objPedido.pedido}'`;
        const result = await sql.query(consulta);
        console.log("resulllllllllllt" , result);
        await closeDatabaseConnection();

        return result.recordset;

    } catch (error) {
        console.error('Error al consultar pedidos por ID:', error.message);
        
    }
}

/**
 * Consultamos base de datos telecontrol(makita)
 * @param {*} osArray 
 * @returns 
 */
async function validarDatos(newArray) {

    try {
        console.log("newArray _ " , newArray);
        logger.info(`Iniciamos la funcion validarDatos`);
        let osDataList = [];
        await connectToDatabase('Telecontrol');
        for (const os of newArray) {

            const consulta = `SELECT * FROM OrdenesServicio where ID_OS = '${os.os}'`;
            const result = await sql.query(consulta);

            if(result.recordset.length === 0){
                osDataList.push(os);
            }
        }
        await closeDatabaseConnection();

        if(osDataList.length > 0 ){
            await insertarOrdenServicio(osDataList);
        }
        
        logger.info(`Fin a la funcion validarDatos`);
       
        return ;
    } catch (error) {
        console.error('Error al validar orden de servicio:', error.message);
       
    }
}


/**
 * Inserta Orden de servicio
 * @param {*} data 
 * @returns 
 */
async function insertarOrdenServicio(data) {
    logger.info(`Iniciamos la funcion insertarOrdenServicio`);
    let result;
    try {
     
        // Conectarse a la base de datos 'telecontrol'
        await connectToDatabase('Telecontrol');
       
        // Armamos data que vamos a mandar al procedimiento almacenado
        for (const ordenServicio of data) {
            const request = new sql.Request(); // Nueva instancia de request en cada iteración
            
            const {
                os: ID_OS,
                idPedido: Folio,
                codigo_posto   : Entidad,
                cnpj: CodigoServicioAut,
                nome: NombreServicioAut,
                data_abertura: FechaAbertura,
                defeito_reclamado_descricao: DescripcionDefecto,
                data_digitacao: FechaDigitalizacion,
                consumidor_fone_comercial: FonoConsumidor,
                consumidor_email: EmailConsumidor,
                consumidor_endereco: DireccionConsumidor,
                consumidor_numero: NumeroConsumidor,
                consumidor_bairro: BarrioConsumidor,
                consumidor_complemento: ComplementoConsumidor,
                consumidor_cep: CepConsumidor,
                consumidor_cidade: CiudadConsumidor,
                consumidor_estado: RegionConsumidor,
                data_fechamento: FechaCierre,
                os_reincidente: OSReincidente,
                referencia: Referencia,
                descricao: DescripcionHerramienta,
                serie: Serie,
                data_fabricacao: FechaFabricacion,
                defeito_reclamado: DefectoReclamado,
                defeito_constatado: DefectoConstatado,
                solucao: Solucion,
                consumidor_nome: NombreConsumidor,
                consumidor_fone: FonoComercialConsumidor,
                consumidor_cpf: CpfConsumidor,
                revenda: Revendedor,
                nota_fiscal: NotaFiscal,
                data_nf: DataNF,
                status_os: StatusOS,
                local_reparo: LocalReparo,
                dias_aberto: DiasAbiertos
            } = ordenServicio;

            // Ejecutar el procedimiento almacenado con los parámetros
              result = await request
                .input('ID_OS', sql.VarChar(20), ID_OS.toString())
                .input('Empresa', sql.VarChar(20), "Makita")
                .input('Folio', sql.Int, ordenServicio.idPedido)
                .input('Entidad', sql.VarChar(50), Entidad.trim())
                .input('CodigoServicioAut', sql.VarChar(50), CodigoServicioAut)
                .input('NombreServicioAut', sql.VarChar(100), NombreServicioAut)
                .input('FechaAbertura', sql.VarChar, formatDate(FechaAbertura) )
                .input('DescripcionDefecto', sql.VarChar(sql.MAX),DescripcionDefecto)
                .input('FechaDigitalizacion', sql.VarChar, formatDate(FechaDigitalizacion))
                .input('FonoConsumidor', sql.VarChar(20), FonoConsumidor)
                .input('EmailConsumidor', sql.VarChar(100), EmailConsumidor)
                .input('DireccionConsumidor', sql.VarChar(100), DireccionConsumidor)
                .input('NumeroConsumidor', sql.VarChar(20), NumeroConsumidor)
                .input('ComplementoConsumidor', sql.VarChar(50), ComplementoConsumidor)
                .input('BarrioConsumidor', sql.VarChar(50), BarrioConsumidor)
                .input('CepConsumidor', sql.VarChar(20), CepConsumidor.trim())
                .input('CiudadConsumidor', sql.VarChar(50), CiudadConsumidor)
                .input('RegionConsumidor', sql.VarChar(50), RegionConsumidor)
                .input('FechaCierre', sql.VarChar, formatDate(FechaCierre))
                .input('OSReincidente', sql.Bit, OSReincidente)
                .input('Referencia', sql.VarChar(100), Referencia)
                .input('DescripcionHerramienta', sql.VarChar(sql.MAX), DescripcionHerramienta)
                .input('Serie', sql.VarChar(50), Serie)
                .input('FechaFabricacion', sql.VarChar,  formatDate(FechaFabricacion))
                .input('DefectoReclamado', sql.VarChar(sql.MAX), DefectoReclamado)
                .input('DefectoConstatado', sql.VarChar(sql.MAX), DefectoConstatado)
                .input('Solucion', sql.VarChar(sql.MAX), Solucion)
                .input('NombreConsumidor', sql.VarChar(100), NombreConsumidor)
                .input('FonoComercialConsumidor', sql.VarChar(20), FonoComercialConsumidor)
                .input('CpfConsumidor', sql.VarChar(20), CpfConsumidor)
                .input('Revendedor', sql.VarChar(100), Revendedor)
                .input('NotaFiscal', sql.VarChar(50), NotaFiscal)
                .input('DataNF', sql.DateTime, formatDate(DataNF))
                .input('StatusOS', sql.VarChar(50), StatusOS)
                .input('LocalReparo', sql.VarChar(20), LocalReparo)
                .input('DiasAbiertos', sql.Int, DiasAbiertos)
                .output('Correlativo', sql.Int)
                .execute('OrdenServicio');

                
        }
       
        await closeDatabaseConnection();
        
        logger.info(`Fin la funcion insertarOrdenServicio ${JSON.stringify(result)}`);
        return result;
    
    } catch (error) {
        
        // Manejamos cualquier error ocurrido durante el proceso
        logger.error(`Error en obtenerOrdenServicio [preparar-pedidos-ms]: ${error.message}`);
        res.status(500).json({ error: `Error en el servidor [preparar-pedidos-ms] :  ${error.message}`  });
    }
}

// Formateamos fecha para procedimiento almacenado
function formatDate(date) {
    
    if(date != null){
        const fechaMoment = moment(date, "DD-MM-YYYY");
        const fechaFormateada = fechaMoment.format("YYYY-MM-DD");
        return fechaFormateada;
    }
}
module.exports = {
    dataValidaCliente, prepararDataPedidos , validaDataPedidos
};
