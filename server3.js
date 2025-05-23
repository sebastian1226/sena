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