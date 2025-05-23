// URL base de la API
const API_BASE_URL = 'http://localhost:3000/api';

function obtenerFechaActualFormateada() {
  const hoy = new Date();
  return hoy.toLocaleDateString('es-ES');
}
/**
 * Obtiene todos los pedidos desde la API.
 * @returns {Array<Object>} Un array de objetos de pedidos.
 */
async function obtenerPedidos() {
    try {
        const res = await fetch(`${API_BASE_URL}/pedidos`);
        if (!res.ok) {
            throw new Error(`Error HTTP! estado: ${res.status}`);
        }
        const data = await res.json();
        return data;
    } catch (error) {
        console.error('Error al obtener pedidos:', error);
        return []; // Retorna un array vacío en caso de error
    }
}

async function obtenerPedidosPorDiaDatos() {
  try {
    const res = await fetch(`${API_BASE_URL}/pedidos-ultimos-7-dias`);
    if (!res.ok) {
      throw new Error(`Error HTTP! estado: ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error al obtener datos de pedidos por día:', error);
    return [];
  }
}


/**
 * Obtiene los datos de ventas por día para los últimos 4 días desde la API.
 * Esta API ya devuelve los datos pre-agrupados.
 * @returns {Array<Object>} Un array de objetos con 'date' y 'totalSales'.
 */
async function obtenerVentasPorDiaDatos() {
    try {
        const res = await fetch(`${API_BASE_URL}/ventas-ultimos-4-dias`);
        if (!res.ok) {
            throw new Error(`Error HTTP! estado: ${res.status}`);
        }
        const data = await res.json();
        return data;
    } catch (error) {
        console.error('Error al obtener datos de ventas por día:', error);
        return []; // Retorna un array vacío en caso de error
    }
}

// La función `agruparPorFecha` ya no es estrictamente necesaria para la gráfica de ventas por día
// porque la nueva API ya devuelve los datos agrupados. Sin embargo, la mantengo si la necesitas
// para otros propósitos o si decides volver a agrupar en el frontend.
/**
 * Agrupa las ventas de pedidos por fecha (formato dd/mm/yyyy).
 * NOTA: Para la gráfica de ventas por día, se recomienda usar la nueva API
 * `/api/ventas-ultimos-4-dias` que ya devuelve los datos pre-agrupados.
 * Esta función asume que cada pedido tiene un campo 'total'.
 * @param {Array<Object>} pedidos - Array de objetos de pedidos.
 * @returns {Object} Objeto donde las claves son fechas y los valores son las ventas totales.
 */
function agruparPorFecha(pedidos) {
    const porFecha = {};
    pedidos.forEach(p => {
        // Asegúrate de que p.fecha sea una fecha válida y p.total exista
        const fecha = new Date(p.fecha).toLocaleDateString('es-ES'); // Formato local para España
        porFecha[fecha] = (porFecha[fecha] || 0) + (p.total || 0); // Suma el total del pedido
    });
    return porFecha;
}

/**
 * Agrupa los pedidos por su estado ('entregado', 'en preparación', etc.).
 * @param {Array<Object>} pedidos - Array de objetos de pedidos.
 * @returns {Object} Objeto donde las claves son estados y los valores son el conteo de pedidos.
 */
function agruparPorEstado(pedidos) {
    const porEstado = {};
    pedidos.forEach(p => {
        porEstado[p.estado] = (porEstado[p.estado] || 0) + 1;
    });
    return porEstado;
}

/**
 * Crea una gráfica utilizando Chart.js en un elemento canvas.
 * @param {string} idCanvas - El ID del elemento canvas HTML.
 * @param {Array<string>} labels - Las etiquetas para el eje X o segmentos.
 * @param {Array<number>} data - Los datos numéricos para la gráfica.
 * @param {string} label - La etiqueta principal para el conjunto de datos.
 * @param {string} [type='bar'] - El tipo de gráfica (ej. 'bar', 'doughnut', 'line').
 */
function crearGrafica(idCanvas, labels, data, label, type = 'bar') {
    // Destruye la instancia anterior de la gráfica si existe para evitar superposiciones
    const existingChart = Chart.getChart(idCanvas);
    if (existingChart) {
        existingChart.destroy();
    }

    new Chart(document.getElementById(idCanvas), {
        type: type,
        data: {
            labels,
            datasets: [{
                label,
                data,
                backgroundColor: [
                    '#4CAF50', // Verde
                    '#2196F3', // Azul
                    '#FFC107', // Amarillo
                    '#FF5722', // Naranja
                    '#9C27B0'  // Púrpura
                ],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                position: 'top',
                labels: {
                    font: {
                    size: 0
                    }
                }
                },
                title: {
                display: true,
                text: label,
                font: {
                    size: 0
                }
                },
                tooltip: {
                // tu configuración actual
                }
            },
            scales: {
                x: {
                ticks: {
                    font: {
                    size: 20
                    }
                }
                },
                y: {
                beginAtZero: true,
                ticks: {
                    font: {
                    size: 20
                    },
                    callback: function(value) {
                    if (idCanvas === 'ventasPorDia') {
                        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
                    }
                    return value;
                    }
                }
                }
            }
            }

    });
}

// Función principal que renderiza el dashboard al cargar la página
(async () => {
    // Mostrar la fecha actual en el div correspondiente
    const fechaDiv = document.getElementById('fechaActual');
    if (fechaDiv) {
        fechaDiv.textContent = 'Fecha actual: ' + obtenerFechaActualFormateada();
    }

    // --- Gráfica 1: Pedidos por Día (usando la API de conteo de pedidos) ---
    const pedidosDiaData = await obtenerPedidosPorDiaDatos();
    const pedidosDiaLabels = pedidosDiaData.map(item => {
    const [year, month, day] = item.date.split('-');
    return `${day}/${month}/${year}`; // Formato DD/MM/YYYY para las etiquetas
    });
    const pedidosDiaValues = pedidosDiaData.map(item => item.totalPedidos);

    crearGrafica(
    'ventasPorDia',
    pedidosDiaLabels,
    pedidosDiaValues,
    'Pedidos por Día',
    'bar'
    );



    // --- Gráfica 2: Pedidos por Estado (usando la API de todos los pedidos) ---
    const pedidos = await obtenerPedidos();
    const porEstado = agruparPorEstado(pedidos);
    crearGrafica(
        'estadoPedidos',
        Object.keys(porEstado),
        Object.values(porEstado),
        'Pedidos por Estado',
        'doughnut'
    );

    // --- Gráfica 3: Evolución en Porcentaje de Ventas por Día (últimos 5 días) ---
const ventasPorDiaDatos = await obtenerVentasPorDiaDatos(); // Ya devuelve { date, totalSales }
if (ventasPorDiaDatos.length > 0) {
    const ventasBase = ventasPorDiaDatos[0].totalSales || 1; // Evita división por cero
    const ventasLabels = ventasPorDiaDatos.map(item => {
        const [year, month, day] = item.date.split('-');
        return `${day}/${month}/${year}`;
    });

    const ventasPorcentajes = ventasPorDiaDatos.map(item => {
        return Math.round((item.totalSales / ventasBase) * 100);
    });

    crearGrafica(
        'pedidosPorDia',
        ventasLabels,
        ventasPorcentajes,
        'Ventas (Índice 100%)',
        'line'
    );
}




})();
