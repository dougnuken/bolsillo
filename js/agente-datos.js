/* ============================================================
   Bolsillo · agente-datos.js
   Reúne la realidad económica actual desde la DB y la convierte en el
   contexto que consume el agente de conciencia. IMPURO (lee IndexedDB).
   Compartido por el chat (asesor) y el susurro por movimiento.
   ============================================================ */

import { getAll, getConfig } from './db.js';
import { calcularEstado, historialAhorro, gastoCategoriasComparado } from './budget.js';
import { categoriaPorId } from './categories.js';
import { construirContexto } from './conciencia.js';
import { construirBriefDeuda } from './diferidos.js';

/**
 * @returns {Promise<{contexto:string, nombre:string, apiKey:string, modelo:string,
 *   creditos:Array<object>, configurado:boolean}>}
 */
export async function armarContexto() {
  const [movimientos, ingresos, recurrentes, creditos, config] = await Promise.all([
    getAll('movimientos'), getAll('ingresos'), getAll('recurrentes'), getAll('creditos'), getConfig(),
  ]);
  // Cortes (snapshots de extractos) → brief de deuda diferida. Blindado: si el
  // store aún no existe o falla, el chat sigue funcionando sin la deuda.
  const cortes = await getAll('cortes').catch(() => []);
  const empleo = ingresos.find((i) => i && i.fuente === 'empleo') || null;
  const salario = empleo ? empleo.monto : 0;
  const hoy = new Date();
  const estado = calcularEstado({ ingresoEmpleo: salario, movimientos, recurrentes, creditos, hoy, config });
  const hist = historialAhorro({ movimientos, ingresoEmpleo: salario, creditos, hoy, meses: 1 });
  const mesAct = hist[hist.length - 1] || {};
  const catComp = gastoCategoriasComparado({ movimientos, hoy, top: 5 });

  // Créditos vivos, completos: el contexto solo lleva un resumen, pero el chat
  // necesita la ficha entera (id, día de pago) para poder vincularle un extracto.
  const activos = (creditos || []).filter((c) => c && c.activo !== false);

  const facts = {
    salario,
    plataDelMes: estado.plataDelMes,
    saldoDisponible: estado.saldoDisponible,
    gastadoTotal: estado.gastadoTotal,
    fijosDelMes: estado.fijosDelMes,
    cuotasCredito: mesAct.cuotasCredito,
    netoMes: mesAct.neto,
    etiquetaSemaforo: estado.etiqueta,
    topCategorias: (catComp.filas || []).map((f) => ({ label: categoriaPorId(f.categoriaId).label, total: f.actual })),
    creditos: activos.map((c) => ({
      entidad: c.entidad, producto: c.producto, cuotaMensual: c.cuotaMensual, saldo: c.saldo, tasaEA: c.tasaEA,
    })),
    deudaDiferidos: construirBriefDeuda(cortes),
  };
  return {
    contexto: construirContexto(facts),
    nombre: (config && config.nombre) || '',
    apiKey: (config && config.apiKey) || '',
    modelo: (config && config.modelos && config.modelos.conciencia) || '',
    modeloExtractos: (config && config.modelos && config.modelos.extractos) || '',
    creditos: activos,
    configurado: estado.configurado,
  };
}
