// server.js
const express = require('express');
const cors = require('cors');
const { connectDB, getDB } = require('./db');
const { ObjectId } = require('mongodb'); // Importar ObjectId desde MongoDB para trabajar con IDs de documentos

const app = express();
const PORT = 3000; // Puerto en el que el servidor escuchará las peticiones

// Habilitar CORS para permitir peticiones desde diferentes orígenes (frontend)
app.use(cors());
// Habilitar el parseo de cuerpos de petición JSON
app.use(express.json());

// Conexión a la base de datos MongoDB
connectDB().then(() => {
  // Ruta para obtener todos los pedidos (documentos diarios de resumen)
  app.get('/api/pedidos', async (req, res) => {
    try {
      const db = getDB(); // Obtener la instancia de la base de datos
      // Buscar todos los documentos en la colección 'pedidos' (que son los resúmenes diarios)
      const pedidos = await db.collection('pedidos').find().toArray();
      res.json(pedidos); // Enviar los documentos diarios como respuesta JSON
    } catch (error) {
      console.error('❌ Error al obtener pedidos:', error);
      res.status(500).json({ mensaje: 'Error al obtener pedidos' }); // Enviar un mensaje de error si algo sale mal
    }
  });

  // RUTA CORREGIDA: Ruta para obtener pedidos en estado "en preparación" desde la estructura anidada
  app.get('/api/pedidos/en-preparacion', async (req, res) => {
    try {
      const db = getDB();
      // Usar una pipeline de agregación para desestructurar y filtrar los pedidos anidados
      const pedidosEnPreparacion = await db.collection('pedidos').aggregate([
        {
          $unwind: '$pedidos' // Desestructura el array 'pedidos' dentro de cada documento diario
        },
        {
          $match: {
            'pedidos.estado': 'en preparación' // Filtra por el campo 'estado' dentro del objeto de pedido desestructurado
          }
        },
        {
          $replaceRoot: { newRoot: '$pedidos' } // Reemplaza el documento raíz con el objeto de pedido desestructurado
        }
      ]).toArray();
      res.json(pedidosEnPreparacion);
    } catch (error) {
      console.error('❌ Error al obtener pedidos en preparación:', error);
      res.status(500).json({ mensaje: 'Error al obtener pedidos en preparación' });
    }
  });

  app.put('/api/pedidos/:id', async (req, res) => {
  const { id } = req.params; // Este 'id' es el _id del pedido ANIDADO

  try {
    const db = getDB();
    // Busca el documento diario que contiene el pedido con el _id especificado en su array 'pedidos'
    const result = await db.collection('pedidos').updateOne(
      { "pedidos._id": new ObjectId(id) }, // Busca el documento diario que contiene el pedido anidado
      {
        $set: { "pedidos.$.estado": 'entregado' } // Actualiza el campo 'estado' del pedido anidado encontrado
        // Nota: Si el 'total_ventas_dia' en el documento diario solo debe incluir pedidos 'entregados',
        // necesitarías una lógica más compleja aquí o recalcularlo periódicamente.
        // Por ahora, solo se actualiza el estado del pedido individual.
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ mensaje: 'Pedido no encontrado o ya está entregado' });
    }

    res.json({ mensaje: 'Estado actualizado a entregado' });
  } catch (error) {
    console.error('❌ Error al actualizar el pedido:', error);
    res.status(500).json({ mensaje: 'Error al actualizar el estado del pedido' });
  }
});

  // Ruta para obtener un ítem del menú por su ID (tipo string)
  app.get('/api/menu/:id', async (req, res) => {
    const { id } = req.params; // Obtener el ID del ítem del menú

    try {
      const db = getDB();
      // Buscar un documento en la colección 'menu' por su campo '_id'
      const item = await db.collection('menu').findOne({ _id: id });

      if (!item) {
        return res.status(404).json({ mensaje: 'Ítem no encontrado' });
      }

      res.json({
        nombre: item.nombre,
        precios: item.precios
      });
    } catch (error) {
      console.error('❌ Error al obtener el ítem del menú:', error);
      res.status(500).json({ mensaje: 'Error al obtener el ítem del menú' });
    }
  });

  // RUTA CORREGIDA: Ruta para agregar un NUEVO pedido (creando o actualizando el resumen diario)
  app.post('/api/pedidos/:productoId/agregar', async (req, res) => {
    const { productoId } = req.params; // ID del producto a agregar
    const { precioId } = req.body; // ID del precio específico del producto

    try {
      const db = getDB();

      const producto = await db.collection('menu').findOne({ _id: productoId });
      if (!producto) {
        return res.status(404).json({ mensaje: 'Producto no encontrado' });
      }

      const precioSeleccionado = producto.precios.find(p => p._id === precioId);
      if (!precioSeleccionado) {
        return res.status(404).json({ mensaje: 'Precio no encontrado' });
      }

      const totalPedido = precioSeleccionado.precio;
      const now = new Date();
      const todayFormatted = now.toISOString().split('T')[0]; // 'YYYY-MM-DD'
      const todayLocale = now.toLocaleDateString('es-ES'); // 'DD/MM/YYYY'

      const nuevoPedidoIndividual = {
        _id: new ObjectId(), // Genera un ObjectId único para este nuevo pedido
        cliente: "Cliente Anónimo",
        fecha: now, // Fecha y hora actual del pedido
        estado: "en preparación",
        items: [
          {
            nombre: producto.nombre,
            cantidad: 1,
            precio: precioSeleccionado.precio,
            tamano: precioSeleccionado.tamano
          }
        ],
        total: totalPedido
      };

      // Intentar encontrar el documento de resumen diario para hoy
      const existingDailySummary = await db.collection('pedidos').findOne({ id_fecha: todayFormatted });

      if (existingDailySummary) {
        // Si el resumen diario existe, añadir el nuevo pedido a su array y actualizar totales
        await db.collection('pedidos').updateOne(
          { _id: existingDailySummary._id },
          {
            $push: { pedidos: nuevoPedidoIndividual },
            $inc: { total_pedidos: 1, total_ventas_dia: totalPedido }
          }
        );
      } else {
        // Si el resumen diario no existe, crear uno nuevo
        const newDailySummary = {
          id_fecha: todayFormatted,
          fecha: todayLocale,
          total_pedidos: 1,
          total_ventas_dia: totalPedido,
          pedidos: [nuevoPedidoIndividual]
        };
        await db.collection('pedidos').insertOne(newDailySummary);
      }

      res.status(201).json({ mensaje: 'Pedido agregado exitosamente (nuevo o añadido a resumen diario).' });
    } catch (error) {
      console.error('❌ Error al agregar el pedido:', error);
      res.status(500).json({ mensaje: 'Error al agregar el pedido' });
    }
  });

  // RUTA CORREGIDA: Ruta para añadir un producto a un pedido existente (anidado)
  // Esta ruta busca el documento diario y luego el pedido dentro de su array.
  app.post('/api/pedidos/:pedidoId/agregar-producto', async (req, res) => {
    const { pedidoId } = req.params; // Este es el _id del pedido ANIDADO
    const { productoId, precioId } = req.body;

    try {
      const db = getDB();

      const producto = await db.collection('menu').findOne({ _id: productoId });
      if (!producto) {
        return res.status(404).json({ mensaje: 'Producto no encontrado' });
      }

      const precioSeleccionado = producto.precios.find(p => p._id === precioId);
      if (!precioSeleccionado) {
        return res.status(404).json({ mensaje: 'Precio no encontrado' });
      }

      const nuevoItem = {
        nombre: producto.nombre,
        cantidad: 1,
        precio: precioSeleccionado.precio,
        tamano: precioSeleccionado.tamano
      };

      // Buscar el documento diario que contiene el pedido y actualizarlo
      // También se actualiza el total_ventas_dia del resumen diario
      const result = await db.collection('pedidos').updateOne(
        { "pedidos._id": new ObjectId(pedidoId) }, // Busca el documento diario que contiene el pedido anidado
        {
          $push: { "pedidos.$.items": nuevoItem }, // Añade el nuevo ítem al array 'items' del pedido encontrado
          $inc: {
            "pedidos.$.total": nuevoItem.precio * nuevoItem.cantidad, // Incrementa el total del pedido anidado
            "total_ventas_dia": nuevoItem.precio * nuevoItem.cantidad // Incrementa el total de ventas del día
          }
        }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({ mensaje: 'Pedido no encontrado o no modificado' });
      }

      res.json({ mensaje: 'Producto añadido al pedido exitosamente' });
    } catch (error) {
      console.error('❌ Error al añadir producto al pedido:', error);
      res.status(500).json({ mensaje: 'Error interno al añadir producto al pedido' });
    }
  });

  // Ruta para obtener todos los ítems del menú (comidas)
  app.get('/api/comidas', async (req, res) => {
    try {
      const db = getDB();
      const comidas = await db.collection('menu').find().toArray(); // Obtener todos los documentos de la colección 'menu'
      res.json(comidas);
    } catch (error) {
      console.error('❌ Error al obtener las comidas:', error);
      res.status(500).json({ mensaje: 'Error al obtener las comidas' });
    }
  });

  // Ruta para agregar una nueva comida al menú o actualizar una existente
  app.post('/api/comidas', async (req, res) => {
    const { nombre, descripcion, categoria, precios } = req.body;

    // Validaciones básicas de los datos de entrada
    if (!nombre || !categoria || !precios || !Array.isArray(precios) || precios.length === 0) {
      return res.status(400).json({ mensaje: 'Nombre, categoría y al menos un precio son requeridos.' });
    }

    // Validar y sanear el primer (y único) elemento de precio enviado
    const parsedPrecioValue = parseFloat(precios[0].precio);
    const newPriceObject = {
      tamano: precios[0].tamano ? String(precios[0].tamano).trim() : 'Único', // Limpiar y asignar tamaño, por defecto 'Único'
      precio: isNaN(parsedPrecioValue) ? 0 : parsedPrecioValue // Asegurar que el precio sea un número
    };

    try {
      const db = getDB();
      const menuCollection = db.collection('menu');

      // Buscar si ya existe una comida con el mismo nombre (insensible a mayúsculas/minúsculas)
      const existingComida = await menuCollection.findOne({ nombre: { $regex: new RegExp(`^${nombre}$`, 'i') } });

      if (existingComida) {
        // Si la comida ya existe, se intenta actualizar o añadir un nuevo precio
        
        // Verificar si el tamaño ya existe dentro del array 'precios' de la comida existente
        const tamanoExiste = existingComida.precios.some(p => p.tamano === newPriceObject.tamano);

        if (tamanoExiste) {
          // Si el tamaño ya existe, actualizar solo el precio de ese tamaño específico
          await menuCollection.updateOne(
            { _id: existingComida._id, "precios.tamano": newPriceObject.tamano }, // Buscar por ID de comida y tamaño de precio
            { $set: { "precios.$.precio": newPriceObject.precio } } // Actualizar el precio del elemento encontrado
          );
          return res.status(200).json({ mensaje: 'Precio actualizado para tamaño existente.' });
        } else {
          // Si el tamaño NO existe, agregar el nuevo objeto de precio al array 'precios'
          newPriceObject._id = 'price_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); // Generar un ID único para el nuevo precio
          await menuCollection.updateOne(
            { _id: existingComida._id }, // Buscar por ID de comida
            { $push: { precios: newPriceObject } } // Añadir el nuevo objeto de precio
          );
          return res.status(200).json({ mensaje: 'Nuevo tamaño y precio añadidos a la comida existente.' });
        }

      } else {
        // Si la comida no existe, crear una nueva entrada en la colección 'menu'
        // Generar IDs únicos para cada precio dentro del array 'precios'
        const pricesForNewItem = precios.map(p => {
          const parsedPrice = parseFloat(p.precio);
          return {
            _id: 'price_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9), // Generar un ID único basado en timestamp y random
            tamano: p.tamano ? String(p.tamano).trim() : 'Único',
            precio: isNaN(parsedPrice) ? 0 : parsedPrice
          };
        });

        const newMenuItem = {
          _id: String(await getNextMenuId()), // Generar un ID secuencial para el nuevo ítem del menú
          nombre,
          descripcion: descripcion || '', // Descripción opcional
          categoria: categoria || '', // Categoría opcional
          precios: pricesForNewItem // Asignar el array de precios con IDs generados
        };
        const result = await menuCollection.insertOne(newMenuItem); // Insertar el nuevo documento
        res.status(201).json({ mensaje: 'Nueva comida agregada exitosamente', comida: newMenuItem });
      }
    } catch (error) {
      console.error('❌ Error al agregar/actualizar la comida:', error);
      res.status(500).json({ mensaje: 'Error al procesar la comida' });
    }
  });

  // Función auxiliar para generar un _id secuencial para la colección 'menu'
  async function getNextMenuId() {
    const db = getDB();
    const lastItem = await db.collection('menu').find().sort({ _id: -1 }).limit(1).toArray();
    if (lastItem.length > 0) {
      const lastIdNum = parseInt(lastItem[0]._id, 10);
      return String(lastIdNum + 1);
    }
    return "1";
  }

  // Ruta para eliminar una comida del menú por su _id (string)
  app.delete('/api/comidas/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const db = getDB();
      const result = await db.collection('menu').deleteOne({ _id: id });

      if (result.deletedCount === 0) {
        return res.status(404).json({ mensaje: 'Comida no encontrada' });
      }

      res.json({ mensaje: 'Comida eliminada exitosamente' });
    } catch (error) {
      console.error('❌ Error al eliminar la comida:', error);
      res.status(500).json({ mensaje: 'Error al eliminar la comida' });
    }
  });

  // Ruta para eliminar un precio/tamaño específico de una comida
  app.delete('/api/comidas/:id/precios/:tamano', async (req, res) => {
    const { id, tamano } = req.params;
    try {
      const db = getDB();
      const result = await db.collection('menu').updateOne(
        { _id: id },
        { $pull: { precios: { tamano: tamano } } }
      );

      if (result.modifiedCount === 0) {
        const existingComida = await db.collection('menu').findOne({ _id: id });
        if (!existingComida) {
          return res.status(404).json({ mensaje: 'Comida no encontrada' });
        } else {
          return res.status(404).json({ mensaje: 'Clasificación/Tamaño no encontrado para esta comida' });
        }
      }

      res.json({ mensaje: `Clasificación/Tamaño "${tamano}" eliminado exitosamente para la comida con ID: ${id}` });
    } catch (error) {
      console.error('❌ Error al eliminar clasificación/tamaño:', error);
      res.status(500).json({ mensaje: 'Error al eliminar clasificación/tamaño' });
    }
  });

  // RUTA CORREGIDA Y MEJORADA: Ruta para agregar datos de pedidos de los últimos 4 días (para seeding)
  // Esta ruta ahora inserta documentos diarios con el array 'pedidos' anidado.
  app.post('/api/seed-pedidos', async (req, res) => {
    try {
      const db = getDB();
      const pedidosCollection = db.collection('pedidos');
      const menuCollection = db.collection('menu');

      const menuItems = await menuCollection.find().toArray();
      if (menuItems.length === 0) {
        return res.status(400).json({ mensaje: 'No hay ítems en el menú. Por favor, agregue ítems al menú primero.' });
      }

      // Opcional: Limpiar la colección de pedidos antes de agregar nuevos datos
      await pedidosCollection.deleteMany({}); // Descomentar si quieres borrar todos los pedidos existentes antes de sembrar

      const dailySummaries = [];
      const today = new Date();
      const orderCounts = [5, 10, 7, 4]; // Hoy: 5, Ayer: 10, Hace 2 días: 7, Hace 3 días: 4

      const getRandomMenuItemAndPrice = () => {
        const randomMenuItem = menuItems[Math.floor(Math.random() * menuItems.length)];
        const randomPriceOption = randomMenuItem.precios[Math.floor(Math.random() * randomMenuItem.precios.length)];
        return { menuItem: randomMenuItem, priceOption: randomPriceOption };
      };

      for (let i = 0; i < 4; i++) {
        const currentDay = new Date(today);
        currentDay.setDate(today.getDate() - i);
        // Establece la hora al inicio del día para la id_fecha
        currentDay.setHours(0, 0, 0, 0);

        const numOrdersForThisDay = orderCounts[i];
        const pedidosForThisDay = [];
        let totalSalesForThisDay = 0;

        for (let j = 0; j < numOrdersForThisDay; j++) {
          const orderTime = new Date(currentDay);
          // Asigna una hora aleatoria dentro del día para cada pedido individual
          orderTime.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);

          const itemsForOrder = [];
          let totalOrderPrice = 0;
          const numItemsInOrder = Math.floor(Math.random() * 3) + 1;

          for (let k = 0; k < numItemsInOrder; k++) {
            const itemAndPrice = getRandomMenuItemAndPrice();
            if (itemAndPrice) {
              const quantity = Math.floor(Math.random() * 2) + 1;
              itemsForOrder.push({
                nombre: itemAndPrice.menuItem.nombre,
                cantidad: quantity,
                precio: itemAndPrice.priceOption.precio,
                tamano: itemAndPrice.priceOption.tamano
              });
              totalOrderPrice += itemAndPrice.priceOption.precio * quantity;
            }
          }

          if (itemsForOrder.length > 0) {
            pedidosForThisDay.push({
              _id: new ObjectId(), // Genera un ObjectId único para cada pedido anidado
              cliente: `Cliente ${Math.floor(Math.random() * 10000)}`,
              fecha: orderTime, // Fecha y hora del pedido individual
              estado: Math.random() > 0.6 ? 'entregado' : 'en preparación',
              items: itemsForOrder,
              total: totalOrderPrice
            });
            totalSalesForThisDay += totalOrderPrice;
          }
        }

        if (pedidosForThisDay.length > 0) {
          dailySummaries.push({
            _id: new ObjectId(), // ID para el documento de resumen diario
            id_fecha: currentDay.toISOString().split('T')[0], // 'YYYY-MM-DD'
            fecha: currentDay.toLocaleDateString('es-ES'), // 'DD/MM/YYYY'
            total_pedidos: pedidosForThisDay.length,
            total_ventas_dia: totalSalesForThisDay,
            pedidos: pedidosForThisDay // Array de pedidos anidados
          });
        }
      }

      if (dailySummaries.length > 0) {
        await pedidosCollection.insertMany(dailySummaries);
        res.status(201).json({ mensaje: 'Datos de pedidos de los últimos 4 días agregados exitosamente.' });
      } else {
        res.status(200).json({ mensaje: 'No se generaron nuevos resúmenes diarios de pedidos.' });
      }
    } catch (error) {
      console.error('❌ Error al agregar datos de pedidos de ejemplo:', error);
      res.status(500).json({ mensaje: 'Error al agregar datos de pedidos de ejemplo.' });
    }
  });

  // Ruta para obtener datos de ventas por día para los últimos 4 días (para la gráfica del dashboard)
  // Esta ruta ya funciona con la estructura de resúmenes diarios
  app.get('/api/ventas-ultimos-4-dias', async (req, res) => {
    try {
      const db = getDB();
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 3);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);

      const ventasPorDia = await db.collection('pedidos').aggregate([
        {
          $match: {
            // Filtra los documentos diarios por el campo 'id_fecha' (string)
            // Esto es más directo ya que id_fecha es 'YYYY-MM-DD'
            id_fecha: {
              $gte: startDate.toISOString().split('T')[0],
              $lte: endDate.toISOString().split('T')[0]
            }
          }
        },
        {
          // Proyecta los campos necesarios para la gráfica
          $project: {
            _id: '$id_fecha', // Usa id_fecha como el _id para agrupar por día
            totalVentas: '$total_ventas_dia'
          }
        },
        {
          $sort: { _id: 1 } // Ordena por fecha ascendente
        }
      ]).toArray();

      // Rellenar los días sin ventas con 0 para los últimos 4 días
      const result = [];
      for (let i = 0; i < 4; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - (3 - i));
        const formattedDate = date.toISOString().split('T')[0]; // Formato YYYY-MM-DD

        const existingData = ventasPorDia.find(item => item._id === formattedDate);
        result.push({
          date: formattedDate,
          totalSales: existingData ? existingData.totalVentas : 0
        });
      }

      res.json(result);
    } catch (error) {
      console.error('❌ Error al obtener ventas por día:', error);
      res.status(500).json({ mensaje: 'Error al obtener ventas por día' });
    }
  });


  // Ruta base del servidor
  app.get('/', (req, res) => {
    res.send('🚀 API de Administración de Pedidos funcionando');
  });

  // Iniciar el servidor y escuchar en el puerto especificado
  app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  });
});
