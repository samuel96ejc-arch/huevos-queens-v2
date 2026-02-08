import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  PlusCircle, 
  Trash2, 
  DollarSign, 
  ClipboardList, 
  Truck, 
  CheckCircle, 
  Calculator,
  Wallet,
  Users,
  Calendar,
  Search,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, collection, onSnapshot } from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDiWfZPVVDQqH4WB0ec1lfOU4w3BZ6Xrl0",
  authDomain: "huevos-queens.firebaseapp.com",
  projectId: "huevos-queens",
  storageBucket: "huevos-queens.firebasestorage.app",
  messagingSenderId: "131121347509",
  appId: "1:131121347509:web:115811e07073d2c7ccf7fc",
  measurementId: "G-NHR66VFBZQ"
};

// Inicializar servicios
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- CONSTANTES ---
const TIPOS_HUEVO = ['Jumbo', 'AAA', 'AA', 'A', 'B', 'C', 'Rotos'];
const DIA_VACIO = {
  invInicial: { 'Jumbo': 0, 'AAA': 0, 'AA': 0, 'A': 0, 'B': 0, 'C': 0, 'Rotos': 0 },
  ventas: [],
  cobros: [],
  gastos: [],
  invFinalFisico: { 'Jumbo': '', 'AAA': '', 'AA': '', 'A': '', 'B': '', 'C': '', 'Rotos': '' }
};

export default function App() {
  // --- ESTADOS ---
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [dbData, setDbData] = useState({});
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [vista, setVista] = useState('diario');
  const [online, setOnline] = useState(navigator.onLine);

  // Estados Temporales
  const [nuevaVenta, setNuevaVenta] = useState({ cliente: '', cantidad: '', tipo: 'A', precioUnitario: '', pagadoAElla: true, metodoPago: 'Efectivo' });
  const [nuevoGasto, setNuevoGasto] = useState({ concepto: '', valor: '' });
  const [busquedaDeudor, setBusquedaDeudor] = useState('');
  const [montoAbono, setMontoAbono] = useState('');
  const [deudorSeleccionado, setDeudorSeleccionado] = useState(null);
  const [metodoPagoAbono, setMetodoPagoAbono] = useState('Efectivo');

  // --- 1. AUTENTICACIÓN ---
  const conectarFirebase = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error("Error auth:", error);
      if (error.code === 'auth/configuration-not-found' || error.code === 'auth/admin-restricted-operation') {
        setAuthError("⚠️ Esperando activación 'Anónimo' en Firebase...");
      } else {
        setAuthError(`Error: ${error.message}`);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    conectarFirebase();
    const unsubscribe = onAuthStateChanged(auth, (usuario) => {
      setUser(usuario);
      if (usuario) {
        setAuthError(null); // Limpiar error si se conecta
      }
    });
    return () => unsubscribe();
  }, []);

  // --- 2. SINCRONIZACIÓN DE DATOS ---
  useEffect(() => {
    if (!user) return;
    
    const collectionRef = collection(db, 'registros_diarios');
    const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
      const newData = {};
      snapshot.forEach(doc => { newData[doc.id] = doc.data(); });
      setDbData(newData);
      setLoading(false);
    }, (error) => {
      console.error("Error BD:", error);
      // Si hay error de permisos, no bloquear la app, solo avisar
      if (error.code === 'permission-denied') {
         setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // --- 3. MAGIA: ARRASTRE DE INVENTARIO ---
  useEffect(() => {
    if (loading || !user) return;
    
    const datosHoy = dbData[fecha];
    const esDiaNuevo = !datosHoy || (datosHoy.invInicial && Object.values(datosHoy.invInicial).every(v => v === 0));

    if (esDiaNuevo) {
      const hoy = new Date(fecha + 'T12:00:00');
      const ayerObj = new Date(hoy);
      ayerObj.setDate(hoy.getDate() - 1);
      const ayer = ayerObj.toISOString().split('T')[0];

      const datosAyer = dbData[ayer];

      if (datosAyer && datosAyer.invFinalFisico) {
        const inventarioHeredado = {};
        let hayDatos = false;

        TIPOS_HUEVO.forEach(tipo => {
          const valorAyer = Number(datosAyer.invFinalFisico[tipo] || 0);
          inventarioHeredado[tipo] = valorAyer;
          if (valorAyer > 0) hayDatos = true;
        });

        if (hayDatos) {
           guardarEnFirebase({ 
             ...(datosHoy || DIA_VACIO),
             invInicial: inventarioHeredado 
           }, fecha);
        }
      }
    }
  }, [fecha, dbData, loading, user]);

  // Monitor de conexión
  useEffect(() => {
    const handleStatus = () => setOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  // --- FUNCIONES DE GUARDADO ---
  const datosDia = dbData[fecha] || DIA_VACIO;

  const guardarEnFirebase = async (datosActualizados, fechaDestino = fecha) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'registros_diarios', fechaDestino);
      await setDoc(docRef, datosActualizados, { merge: true });
    } catch (e) { console.error("Error guardando:", e); }
  };

  const handleInvInicialChange = (tipo, valor) => {
    guardarEnFirebase({ ...datosDia, invInicial: { ...datosDia.invInicial, [tipo]: Number(valor) } });
  };

  const handleInvFinalChange = (tipo, valor) => {
    guardarEnFirebase({ ...datosDia, invFinalFisico: { ...datosDia.invFinalFisico, [tipo]: valor } });
  };

  const agregarVenta = () => {
    if (!nuevaVenta.cliente || !nuevaVenta.cantidad || !nuevaVenta.precioUnitario) return;
    const venta = {
      id: Date.now(), fechaRegistro: fecha, ...nuevaVenta,
      cantidad: Number(nuevaVenta.cantidad), precioUnitario: Number(nuevaVenta.precioUnitario),
      total: Number(nuevaVenta.cantidad) * Number(nuevaVenta.precioUnitario),
      abonado: nuevaVenta.pagadoAElla ? (Number(nuevaVenta.cantidad) * Number(nuevaVenta.precioUnitario)) : 0
    };
    guardarEnFirebase({ ...datosDia, ventas: [...datosDia.ventas || [], venta] });
    setNuevaVenta({ ...nuevaVenta, cliente: '', cantidad: '', precioUnitario: '' });
  };

  const borrarVenta = (id) => {
    guardarEnFirebase({ ...datosDia, ventas: datosDia.ventas.filter(v => v.id !== id) });
  };

  const agregarGasto = () => {
    if (!nuevoGasto.concepto || !nuevoGasto.valor) return;
    const gasto = { id: Date.now(), concepto: nuevoGasto.concepto, valor: Number(nuevoGasto.valor) };
    guardarEnFirebase({ ...datosDia, gastos: [...datosDia.gastos || [], gasto] });
    setNuevoGasto({ concepto: '', valor: '' });
  };

  const borrarGasto = (id) => {
    guardarEnFirebase({ ...datosDia, gastos: datosDia.gastos.filter(g => g.id !== id) });
  };

  const borrarCobroHoy = (cobro) => {
    guardarEnFirebase({ ...datosDia, cobros: datosDia.cobros.filter(c => c.id !== cobro.id) });
  };

  // --- LÓGICA DE CARTERA ---
  const listaDeudores = useMemo(() => {
    let deudores = [];
    Object.keys(dbData).forEach(fechaKey => {
      const dia = dbData[fechaKey];
      if (dia.ventas) {
        dia.ventas.forEach(venta => {
          if (venta.abonado < venta.total) {
            deudores.push({ ...venta, fechaOriginal: fechaKey, saldoPendiente: venta.total - venta.abonado });
          }
        });
      }
    });
    return deudores.sort((a, b) => new Date(b.fechaOriginal) - new Date(a.fechaOriginal));
  }, [dbData]);

  const realizarCobroDeuda = async () => {
    if (!deudorSeleccionado || !montoAbono) return;
    const valorAbono = Number(montoAbono);
    const fechaOriginal = deudorSeleccionado.fechaOriginal;
    const nuevoCobro = {
      id: Date.now(), 
      cliente: deudorSeleccionado.cliente, 
      valor: valorAbono,
      metodoPago: metodoPagoAbono, 
      refVentaId: deudorSeleccionado.id, 
      nota: `Abono a venta del ${fechaOriginal}`
    };
    const diaOriginal = dbData[fechaOriginal];
    const ventasActualizadas = diaOriginal.ventas.map(v => v.id === deudorSeleccionado.id ? { ...v, abonado: v.abonado + valorAbono } : v);
    
    await Promise.all([
      guardarEnFirebase({ ...datosDia, cobros: [...datosDia.cobros || [], nuevoCobro] }, fecha),
      guardarEnFirebase({ ...diaOriginal, ventas: ventasActualizadas }, fechaOriginal)
    ]);
    
    setMontoAbono(''); 
    setDeudorSeleccionado(null); 
    setMetodoPagoAbono('Efectivo');
    setVista('diario');
  };

  // --- CÁLCULOS VISUALES ---
  const calcularInvTeorico = (tipo) => (datosDia.invInicial?.[tipo] || 0) - (datosDia.ventas || []).filter(v => v.tipo === tipo).reduce((sum, v) => sum + v.cantidad, 0);
  
  const ventasEfectivoHoy = (datosDia.ventas || []).filter(v => v.pagadoAElla && v.metodoPago === 'Efectivo').reduce((sum, v) => sum + v.total, 0);
  const ventasNequiHoy = (datosDia.ventas || []).filter(v => v.pagadoAElla && v.metodoPago === 'Nequi').reduce((sum, v) => sum + v.total, 0);
  
  const cobrosEfectivoHoy = (datosDia.cobros || []).filter(c => c.metodoPago === 'Efectivo').reduce((sum, c) => sum + c.valor, 0);
  const cobrosNequiHoy = (datosDia.cobros || []).filter(c => c.metodoPago === 'Nequi').reduce((sum, c) => sum + c.valor, 0);

  const totalGastos = (datosDia.gastos || []).reduce((sum, g) => sum + g.valor, 0);
  
  const efectivoEnMano = (ventasEfectivoHoy + cobrosEfectivoHoy) - totalGastos;
  const totalEnNequi = ventasNequiHoy + cobrosNequiHoy;
  const totalAConsignar = efectivoEnMano + totalEnNequi;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-yellow-50 text-yellow-800 flex-col gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-yellow-600"></div>
      <p className="font-bold animate-pulse">Cargando Huevos Queens...</p>
      {authError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 max-w-md mx-4 mt-4 rounded shadow-lg text-center">
          <p className="font-bold mb-2">¡Casi listo!</p>
          <p className="text-sm mb-3">Tu base de datos ya está configurada, pero necesitamos recargar para detectar el cambio.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 mx-auto hover:bg-red-700 transition-colors"
          >
            <RefreshCw size={20} /> Recargar Página
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 p-2 md:p-4 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-xl overflow-hidden min-h-[800px]">
        {/* HEADER */}
        <div className="bg-yellow-500 p-4 text-white shadow-md sticky top-0 z-50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 text-white drop-shadow-md">
                <ClipboardList className="h-6 w-6" />
                Huevos Queens
              </h1>
              <p className="text-yellow-100 text-xs font-medium flex items-center gap-2">
                 {online ? <span className="flex items-center gap-1"><Wifi size={10}/> Online</span> : <span className="flex items-center gap-1 text-red-200"><WifiOff size={10}/> Offline</span>}
              </p>
            </div>
            
            <div className="flex gap-4 items-center bg-yellow-600 p-2 rounded-lg">
                <label className="text-xs font-bold text-yellow-100 uppercase">FECHA:</label>
                <input 
                  type="date" 
                  value={fecha} 
                  onChange={(e) => setFecha(e.target.value)}
                  className="bg-white text-slate-800 border-none rounded p-1 font-bold focus:ring-2 focus:ring-blue-300 shadow-inner cursor-pointer"
                />
            </div>
          </div>

          {/* NAVEGACIÓN */}
          <div className="flex mt-4 gap-2">
            <button onClick={() => setVista('diario')} className={`flex-1 py-2 rounded-t-lg font-bold flex items-center justify-center gap-2 transition-colors ${vista === 'diario' ? 'bg-white text-yellow-600' : 'bg-yellow-600 text-yellow-100 hover:bg-yellow-700'}`}>
              <Calendar size={18} /> Caja del Día
            </button>
            <button onClick={() => setVista('cartera')} className={`flex-1 py-2 rounded-t-lg font-bold flex items-center justify-center gap-2 transition-colors ${vista === 'cartera' ? 'bg-white text-blue-600' : 'bg-blue-800 text-blue-100 hover:bg-blue-900'}`}>
              <Users size={18} /> Cartera ({listaDeudores.length})
            </button>
          </div>
        </div>

        {/* --- CONTENIDO --- */}
        <div className="p-4 md:p-6">
          {vista === 'cartera' && (
            <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
               <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6 flex justify-between items-center">
                 <div>
                   <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2 mb-1"><Wallet className="h-6 w-6" /> Cuentas por Cobrar</h2>
                   <p className="text-sm text-blue-700">Gestiona las deudas pendientes.</p>
                 </div>
               </div>
              <div className="relative mb-6">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input type="text" placeholder="Buscar cliente..." className="w-full pl-10 p-4 rounded-xl border border-blue-200 shadow-sm focus:ring-2 focus:ring-blue-400 outline-none text-lg" value={busquedaDeudor} onChange={(e) => setBusquedaDeudor(e.target.value)} />
              </div>
              <div className="space-y-4">
                {listaDeudores.filter(d => d.cliente.toLowerCase().includes(busquedaDeudor.toLowerCase())).map((item) => (
                  <div key={item.id} className="bg-white p-5 rounded-xl shadow-sm border border-blue-100 hover:border-blue-300 transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-2 h-full bg-red-400"></div>
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-xl text-gray-800">{item.cliente}</h3>
                        <p className="text-gray-500 text-sm flex items-center gap-2"><Calendar size={12}/> {item.fechaOriginal} • {item.cantidad} {item.tipo}</p>
                        <p className="mt-2 text-red-600 font-bold bg-red-50 inline-block px-3 py-1 rounded-lg">Debe: ${item.saldoPendiente.toLocaleString()}</p>
                      </div>
                      {deudorSeleccionado?.id === item.id ? (
                        <div className="bg-green-50 p-4 rounded-xl border border-green-200 flex flex-col gap-2 w-full sm:w-auto">
                          <label className="text-xs font-bold text-green-800 uppercase">Abono Hoy</label>
                          <div className="flex gap-2 flex-wrap">
                             <input type="number" autoFocus className="w-full sm:w-32 p-2 border rounded border-green-300" placeholder="$ Monto" value={montoAbono} onChange={(e) => setMontoAbono(e.target.value)} />
                             
                             {/* SELECCIÓN DE MÉTODO DE PAGO */}
                             <div className="flex gap-1 bg-white rounded border border-green-300 p-1">
                               <button 
                                  onClick={() => setMetodoPagoAbono('Efectivo')}
                                  className={`px-3 py-1 text-xs rounded font-bold ${metodoPagoAbono === 'Efectivo' ? 'bg-green-500 text-white' : 'text-gray-500'}`}
                               >Efectivo</button>
                               <button 
                                  onClick={() => setMetodoPagoAbono('Nequi')}
                                  className={`px-3 py-1 text-xs rounded font-bold ${metodoPagoAbono === 'Nequi' ? 'bg-purple-500 text-white' : 'text-gray-500'}`}
                               >Nequi</button>
                             </div>

                             <button onClick={realizarCobroDeuda} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 shadow-sm flex-1">Cobrar</button>
                             <button onClick={() => setDeudorSeleccionado(null)} className="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg font-bold hover:bg-gray-300">X</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setDeudorSeleccionado(item); setMontoAbono(item.saldoPendiente); setMetodoPagoAbono('Efectivo'); }} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-md flex items-center gap-2 w-full sm:w-auto justify-center group-hover:scale-105 transition-transform"><DollarSign size={18} /> Pagar</button>
                      )}
                    </div>
                  </div>
                ))}
                {listaDeudores.length === 0 && <div className="text-center py-10 text-gray-400">No hay deudas pendientes.</div>}
              </div>
            </div>
          )}

          {vista === 'diario' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 shadow-sm">
                  <h2 className="font-bold text-blue-900 mb-4 flex items-center gap-2 border-b border-blue-200 pb-2"><Package className="h-5 w-5" /> 1. Inventario Inicial</h2>
                  <div className="space-y-2">
                    {TIPOS_HUEVO.map(tipo => (
                      <div key={tipo} className="flex items-center justify-between bg-white p-2 rounded border border-blue-100 shadow-sm">
                        <span className="font-bold text-gray-700 w-16 pl-2">{tipo}</span>
                        <input type="number" placeholder="0" className="w-24 p-1 border border-blue-200 rounded text-center font-bold text-blue-800 focus:ring-2 focus:ring-blue-300 outline-none" value={datosDia.invInicial?.[tipo] || ''} onChange={(e) => handleInvInicialChange(tipo, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-400 mt-2 text-center italic">* Si ayer sobraron huevos, se cargan aquí solos.</p>
                </div>
                <div className="bg-red-50 p-5 rounded-xl border border-red-200 shadow-sm">
                  <h2 className="font-bold text-red-900 mb-3 flex items-center gap-2 border-b border-red-200 pb-2"><Truck className="h-5 w-5" /> Gastos del Día</h2>
                  <div className="flex gap-2 mb-3">
                    <input placeholder="Concepto" className="w-full p-2 border rounded text-sm" value={nuevoGasto.concepto} onChange={e => setNuevoGasto({...nuevoGasto, concepto: e.target.value})} />
                    <input type="number" placeholder="$" className="w-24 p-2 border rounded text-sm" value={nuevoGasto.valor} onChange={e => setNuevoGasto({...nuevoGasto, valor: e.target.value})} />
                    <button onClick={agregarGasto} className="bg-red-600 text-white p-2 rounded hover:bg-red-700 shadow-sm"><PlusCircle size={20} /></button>
                  </div>
                  <ul className="text-sm space-y-2">
                    {(datosDia.gastos || []).map(g => (
                      <li key={g.id} className="flex justify-between items-center bg-white p-2 rounded border border-red-100">
                        <span className="text-gray-700">{g.concepto}</span>
                        <div className="flex items-center gap-2"><span className="font-bold text-red-600">-${g.valor.toLocaleString()}</span><button onClick={() => borrarGasto(g.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={14}/></button></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-lg border-b pb-2"><Calculator className="h-5 w-5 text-green-600" /> 2. Nueva Venta</h2>
                  <div className="grid grid-cols-12 gap-3 mb-4 bg-gray-50 p-5 rounded-xl border border-gray-200 items-end">
                    <div className="col-span-6 md:col-span-3">
                      <label className="text-xs font-bold text-gray-500 ml-1">Cliente</label>
                      <input placeholder="Nombre" className="w-full p-2 border rounded focus:ring-2 focus:ring-green-200 outline-none" value={nuevaVenta.cliente} onChange={e => setNuevaVenta({...nuevaVenta, cliente: e.target.value})} />
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <label className="text-xs font-bold text-gray-500 ml-1">Cant.</label>
                      <input type="number" placeholder="#" className="w-full p-2 border rounded focus:ring-2 focus:ring-green-200 outline-none" value={nuevaVenta.cantidad} onChange={e => setNuevaVenta({...nuevaVenta, cantidad: e.target.value})} />
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <label className="text-xs font-bold text-gray-500 ml-1">Tipo</label>
                      <select className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-green-200 outline-none" value={nuevaVenta.tipo} onChange={e => setNuevaVenta({...nuevaVenta, tipo: e.target.value})}>
                        {TIPOS_HUEVO.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <label className="text-xs font-bold text-gray-500 ml-1">Precio Total</label>
                      <input type="number" placeholder="$ Unitario" className="w-full p-2 border rounded focus:ring-2 focus:ring-green-200 outline-none" value={nuevaVenta.precioUnitario} onChange={e => setNuevaVenta({...nuevaVenta, precioUnitario: e.target.value})} />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                        <button onClick={agregarVenta} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-[42px] rounded-lg shadow-md flex items-center justify-center transition-transform active:scale-95"><PlusCircle size={24} /></button>
                    </div>
                    <div className="col-span-12 pt-2 border-t border-gray-200 mt-2 grid grid-cols-2 gap-4">
                        <div className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${nuevaVenta.pagadoAElla ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-300'}`} onClick={() => setNuevaVenta({...nuevaVenta, pagadoAElla: true})}>
                          <div className={`w-5 h-5 rounded border flex items-center justify-center ${nuevaVenta.pagadoAElla ? 'bg-green-500 border-green-500' : 'bg-white border-gray-400'}`}>{nuevaVenta.pagadoAElla && <CheckCircle size={14} className="text-white" />}</div><span className="text-sm font-bold text-gray-700">Paga Ya</span>
                        </div>
                        <div className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${!nuevaVenta.pagadoAElla ? 'bg-red-50 border-red-200' : 'bg-gray-100 border-gray-300'}`} onClick={() => setNuevaVenta({...nuevaVenta, pagadoAElla: false})}>
                          <div className={`w-5 h-5 rounded border flex items-center justify-center ${!nuevaVenta.pagadoAElla ? 'bg-red-500 border-red-500' : 'bg-white border-gray-400'}`}>{!nuevaVenta.pagadoAElla && <CheckCircle size={14} className="text-white" />}</div><span className="text-sm font-bold text-gray-700">Queda Debiendo</span>
                        </div>
                    </div>
                    {nuevaVenta.pagadoAElla && (
                      <div className="col-span-12 mt-1 flex gap-4">
                           <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="metodo" checked={nuevaVenta.metodoPago === 'Efectivo'} onChange={() => setNuevaVenta({...nuevaVenta, metodoPago: 'Efectivo'})} className="accent-green-600"/> Efectivo</label>
                           <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="metodo" checked={nuevaVenta.metodoPago === 'Nequi'} onChange={() => setNuevaVenta({...nuevaVenta, metodoPago: 'Nequi'})} className="accent-purple-600"/> Nequi</label>
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden border border-gray-200 rounded-lg">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                        <tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3 text-center">Cant</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-center">Estado</th><th className="px-4 py-3"></th></tr>
                      </thead>
                      <tbody>
                        {(datosDia.ventas || []).map((v) => (
                          <tr key={v.id} className="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-700">{v.cliente}</td>
                            <td className="px-4 py-3 text-center text-gray-600">{v.cantidad} <span className="text-[10px] bg-gray-100 px-1 rounded">{v.tipo}</span></td>
                            <td className="px-4 py-3 text-right font-bold text-gray-800">${v.total.toLocaleString()}</td>
                            <td className="px-4 py-3 text-center">
                              {v.abonado >= v.total ? (
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${v.metodoPago === 'Nequi' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{v.metodoPago === 'Nequi' ? 'NEQUI' : 'EFECTIVO'}</span>
                              ) : <span className="text-red-600 bg-red-100 px-2 py-1 rounded-full text-[10px] font-bold">DEBE</span>}
                            </td>
                            <td className="px-4 py-3 text-right"><button onClick={() => borrarVenta(v.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={16} /></button></td>
                          </tr>
                        ))}
                        {(datosDia.ventas || []).length === 0 && <tr><td colSpan="5" className="text-center py-8 text-gray-400 italic">No hay ventas hoy</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm">
                   <h2 className="font-bold text-green-900 mb-3 flex items-center gap-2 text-lg"><Wallet className="h-5 w-5 text-green-700" /> 3. Cobros de Hoy (Deudas Viejas)</h2>
                    {(datosDia.cobros || []).length > 0 ? (
                      <ul className="space-y-2">
                          {datosDia.cobros.map(c => (
                              <li key={c.id} className="bg-white p-3 rounded-lg border border-green-100 flex justify-between items-center shadow-sm">
                                  <div><span className="font-bold text-gray-700">{c.cliente}</span><span className="text-xs text-green-600 ml-2 bg-green-50 px-2 py-0.5 rounded-full">{c.nota}</span></div>
                                  <div className="flex items-center gap-2">
                                    {c.metodoPago === 'Nequi' ? <span className="text-[10px] bg-purple-100 text-purple-600 px-1 rounded font-bold">NEQUI</span> : <span className="text-[10px] bg-green-100 text-green-600 px-1 rounded font-bold">EFECTIVO</span>}
                                    <span className="font-bold text-green-600">+${c.valor.toLocaleString()}</span>
                                    <button onClick={() => borrarCobroHoy(c)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                                  </div>
                              </li>
                          ))}
                      </ul>
                    ) : <p className="text-xs text-green-700 italic pl-2">Nadie ha pagado deudas hoy.</p>}
                </div>

                <div className="bg-slate-800 text-white p-6 rounded-xl border-t-4 border-yellow-500 shadow-2xl mt-4">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-yellow-400"><CheckCircle className="h-8 w-8" /> 4. Cuadre Final ({fecha})</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-700 p-5 rounded-xl shadow-inner border border-slate-600">
                      <h3 className="font-bold mb-4 border-b border-slate-600 pb-2 text-lg text-blue-200">📦 Huevos Físicos</h3>
                      <table className="w-full text-sm">
                        <thead><tr className="text-gray-400 text-xs uppercase"><th className="text-left pb-2">Tipo</th><th className="text-center pb-2 text-white">Debe Haber</th><th className="text-center pb-2 text-yellow-400">Hay Real</th><th className="text-center pb-2">Dif.</th></tr></thead>
                        <tbody>
                          {TIPOS_HUEVO.map(tipo => {
                            const teorico = calcularInvTeorico(tipo);
                            // Ocultar filas vacías si no hay movimiento
                            if ((datosDia.invInicial?.[tipo] || 0) === 0 && teorico === 0) return null;
                            const real = Number(datosDia.invFinalFisico?.[tipo] || 0);
                            const diff = real - teorico;
                            return (
                              <tr key={tipo} className="border-b border-slate-600 last:border-0 hover:bg-slate-600">
                                <td className="py-2 font-bold text-yellow-100">{tipo}</td>
                                <td className="py-2 text-center font-bold bg-slate-600 rounded">{teorico}</td>
                                <td className="py-2 text-center"><input type="number" className="w-16 bg-slate-900 border border-slate-500 text-center rounded text-yellow-300 font-bold focus:ring-1 focus:ring-yellow-500 p-1 outline-none" placeholder="0" value={datosDia.invFinalFisico?.[tipo] || ''} onChange={(e) => handleInvFinalChange(tipo, e.target.value)} /></td>
                                <td className={`py-2 text-center font-bold ${diff !== 0 ? 'text-red-400' : 'text-green-400'}`}>{real > 0 ? (diff === 0 ? 'OK' : diff) : '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-slate-700 p-5 rounded-xl shadow-inner border border-slate-600 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold mb-4 border-b border-slate-600 pb-2 text-lg text-green-200">💰 Dinero Real</h3>
                        <div className="space-y-3 font-medium">
                          <div className="flex justify-between text-gray-300"><span>(+) Ventas Hoy (Efectivo):</span><span>${ventasEfectivoHoy.toLocaleString()}</span></div>
                          <div className="flex justify-between text-green-300 bg-green-900/30 p-2 rounded border border-green-900/50"><span>(+) Cobros Deudas (Efectivo):</span><span>+${cobrosEfectivoHoy.toLocaleString()}</span></div>
                          <div className="flex justify-between text-red-300"><span>(-) Gastos:</span><span>-${totalGastos.toLocaleString()}</span></div>
                          <div className="border-t-2 border-slate-500 my-2 pt-2 flex justify-between font-bold text-2xl text-green-400"><span>= EFECTIVO EN MANO:</span><span>${efectivoEnMano.toLocaleString()}</span></div>
                          <div className="mt-6 pt-4 border-t border-dashed border-slate-500">
                            <div className="flex justify-between text-purple-300 text-sm mb-1"><span>(+) Plata en Nequi (Ventas):</span><span>${ventasNequiHoy.toLocaleString()}</span></div>
                            <div className="flex justify-between text-purple-300 text-sm mb-1"><span>(+) Plata en Nequi (Cobros):</span><span>${cobrosNequiHoy.toLocaleString()}</span></div>
                            <div className="flex justify-between font-bold text-xl text-white bg-blue-600 p-4 rounded-lg mt-2 shadow-lg border border-blue-500"><span>TOTAL A CONSIGNAR:</span><span>${totalAConsignar.toLocaleString()}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}