import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, LayerGroup, ZoomControl, GeoJSON, useMap, CircleMarker, useMapEvents, Polyline } from 'react-leaflet';
import { AlertTriangle, Droplets, MapPin, Search, Shield, Settings, Activity, Calendar } from 'lucide-react';
import L, { Icon } from 'leaflet';

// Icons setup
const valveIcon = new Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/869/869114.png',
  iconSize: [24, 24]
});

const homeIcon = new Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/25/25694.png',
  iconSize: [24, 24]
});

const alertIcon = new Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/564/564246.png',
  iconSize: [30, 30]
});

function MapController({ 
  setMap, 
  drawingType, 
  setDrawingType,
  lineVertices, 
  setLineVertices, 
  setNewFeatureCoords, 
  setNewFeatureModalOpen 
}: { 
  setMap: (map: any) => void,
  drawingType: 'toma' | 'valvula' | 'tuberia' | null,
  setDrawingType: (type: 'toma' | 'valvula' | 'tuberia' | null) => void,
  lineVertices: [number, number][],
  setLineVertices: React.Dispatch<React.SetStateAction<[number, number][]>>,
  setNewFeatureCoords: (coords: any) => void,
  setNewFeatureModalOpen: (open: boolean) => void
}) {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      setMap(map);
    }
  }, [map, setMap]);

  useMapEvents({
    click(e) {
      if (!drawingType) return;

      const { lat, lng } = e.latlng;

      if (drawingType === 'toma' || drawingType === 'valvula') {
        setNewFeatureCoords({ lat, lng });
        setNewFeatureModalOpen(true);
        setDrawingType(null);
      } else if (drawingType === 'tuberia') {
        setLineVertices((prev) => [...prev, [lat, lng]]);
      }
    },
  });

  return null;
}

function App() {
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState('Administrador');
  const [isAdmin, setIsAdmin] = useState(true);
  const isOperador = currentRole === 'Administrador' || currentRole === 'Operador de Campo';
  
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  const [postgisModalOpen, setPostgisModalOpen] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState('1');
  const [postgisResults, setPostgisResults] = useState<any>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLayer, setImportLayer] = useState('tuberias');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMessage, setImportMessage] = useState('');

  const [qgisModalOpen, setQgisModalOpen] = useState(false);

  const [drawingType, setDrawingType] = useState<'toma' | 'valvula' | 'tuberia' | null>(null);
  const [lineVertices, setLineVertices] = useState<[number, number][]>([]);
  const [newFeatureCoords, setNewFeatureCoords] = useState<any>(null);
  const [newFeatureModalOpen, setNewFeatureModalOpen] = useState(false);
  
  const [newIdentificador, setNewIdentificador] = useState('');
  const [newTitular, setNewTitular] = useState('');
  const [newMaterialId, setNewMaterialId] = useState('1');
  const [newDiametro, setNewDiametro] = useState('2');
  const [newTipoId, setNewTipoId] = useState('1');
  const [newEstado, setNewEstado] = useState('Funcional');

  const handleCreateFeature = (e: React.FormEvent) => {
    e.preventDefault();
    
    let endpoint = '';
    let body: any = {
      identificador: newIdentificador,
    };

    if (drawingType === 'toma' || (!drawingType && newFeatureCoords && !lineVertices.length)) {
      endpoint = '/api/tomas';
      body = {
        ...body,
        titular: newTitular,
        estado_fisico: newEstado,
        material_id: newMaterialId,
        lat: newFeatureCoords?.lat,
        lng: newFeatureCoords?.lng
      };
    } else if (drawingType === 'valvula') {
      endpoint = '/api/valvulas';
      body = {
        ...body,
        tipo_id: newTipoId,
        estado_operativo: newEstado === 'Funcional' ? 'Abierta' : 'Cerrada',
        lat: newFeatureCoords?.lat,
        lng: newFeatureCoords?.lng
      };
    } else if (lineVertices.length > 0) {
      endpoint = '/api/tuberias';
      body = {
        ...body,
        material_id: newMaterialId,
        diametro_pulgadas: newDiametro,
        coordinates: lineVertices
      };
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      setNewFeatureModalOpen(false);
      setLineVertices([]);
      setNewFeatureCoords(null);
      setNewIdentificador('');
      setNewTitular('');
      fetchTomas();
      fetchValvulas();
      fetchTuberias();
      fetchStats();
    })
    .catch(err => alert(`Error: ${err.message}`));
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const geojson = JSON.parse(event.target?.result as string);
        fetch('/api/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layer: importLayer, geojson })
        })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setImportMessage(`Error: ${data.error}`);
          } else {
            setImportMessage(data.message);
            if (importLayer === 'tomas') fetchTomas();
            if (importLayer === 'valvulas') fetchValvulas();
            if (importLayer === 'tuberias') fetchTuberias();
            fetchStats();
          }
        })
        .catch(err => setImportMessage(`Error: ${err.message}`));
      } catch (err) {
        setImportMessage('Error: El archivo no es un GeoJSON válido.');
      }
    };
    reader.readAsText(importFile);
  };

  const fetchUsers = () => {
    fetch('/api/usuarios')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('Error fetching users:', err));
  };

  const updateUserRole = (userId: string, newRole: string) => {
    fetch(`/api/usuarios/${userId}/rol`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rol: newRole })
    })
    .then(res => res.json())
    .then(data => {
      alert('Rol actualizado exitosamente.');
      fetchUsers();
    })
    .catch(err => console.error('Error updating user role:', err));
  };

  const executePostgisQuery = (queryId: string) => {
    fetch(`/api/postgis/consultas/${queryId}`)
      .then(res => res.json())
      .then(data => {
        setPostgisResults(data);
        if (data.geojson && data.geojson.features && data.geojson.features.length > 0) {
          const firstFeature = data.geojson.features[0];
          if (firstFeature.geometry && firstFeature.geometry.type === 'Point') {
            const coords = firstFeature.geometry.coordinates;
            map?.flyTo([coords[1], coords[0]], 17);
          }
        }
      })
      .catch(err => console.error('Error executing PostGIS query:', err));
  };
  const [tomas, setTomas] = useState<any>(null);
  const [valvulas, setValvulas] = useState<any>(null);
  const [tuberias, setTuberias] = useState<any>(null);
  
  const [showTomas, setShowTomas] = useState(true);
  const [showValvulas, setShowValvulas] = useState(true);
  const [showTuberias, setShowTuberias] = useState(true);
  const [showReportes, setShowReportes] = useState(true);
  
  const [sectores, setSectores] = useState<any>(null);
  const [manzanas, setManzanas] = useState<any>(null);
  const [showSectores, setShowSectores] = useState(true);
  const [showManzanas, setShowManzanas] = useState(false);
  
  const [municipio, setMunicipio] = useState<any>(null);
  const [colonia, setColonia] = useState<any>(null);
  const [showMunicipio, setShowMunicipio] = useState(true);
  const [showColonia, setShowColonia] = useState(true);

  const [stats, setStats] = useState<any>(null);
  const [affectedData, setAffectedData] = useState<{ tuberias: any, tomas: any } | null>(null);

  const runSimulation = (valveId: string) => {
    fetch(`/api/valvulas/${valveId}/afectacion`)
      .then(res => res.json())
      .then(data => {
        setAffectedData({
          tuberias: data.tuberias_afectadas,
          tomas: data.tomas_afectadas
        });
      })
      .catch(err => console.error('Error running simulation:', err));
  };

  const fetchStats = () => {
    fetch('/api/estadisticas')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Error fetching stats:', err));
  };

  const [map, setMap] = useState<any>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const flyToLocation = (id: string, lat: number, lng: number) => {
    if (map) {
      map.flyTo([lat, lng], 18);
      setSelectedReportId(id);
      setReportsModalOpen(false);
    }
  };

  const [allReports, setAllReports] = useState<any[]>([]);
  const [reportsModalOpen, setReportsModalOpen] = useState(false);
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterDiametro, setFilterDiametro] = useState<number | string>('');
  const [filterMantenimiento, setFilterMantenimiento] = useState('all');

  const fetchReports = () => {
    fetch('/api/reportes')
      .then(res => res.json())
      .then(data => setAllReports(data))
      .catch(err => console.error('Error fetching reports:', err));
  };

  const updateReportStatus = (id: string, newStatus: string) => {
    fetch(`/api/reportes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: newStatus }),
    })
    .then(res => res.json())
    .then(data => {
      fetchReports();
      fetchStats();
    })
    .catch(err => console.error('Error updating report status:', err));
  };

  const fetchTomas = () => {
    fetch('/api/tomas')
      .then(res => res.json())
      .then(data => setTomas(data))
      .catch(err => console.error('Error fetching tomas:', err));
  };

  const fetchValvulas = () => {
    fetch('/api/valvulas')
      .then(res => res.json())
      .then(data => setValvulas(data))
      .catch(err => console.error('Error fetching valvulas:', err));
  };

  const fetchTuberias = () => {
    fetch('/api/tuberias')
      .then(res => res.json())
      .then(data => setTuberias(data))
      .catch(err => console.error('Error fetching tuberias:', err));
  };

  const fetchSectores = () => {
    fetch('/api/sectores')
      .then(res => res.json())
      .then(data => setSectores(data))
      .catch(err => console.error('Error fetching sectores:', err));
  };

  const fetchManzanas = () => {
    fetch('/api/manzanas')
      .then(res => res.json())
      .then(data => setManzanas(data))
      .catch(err => console.error('Error fetching manzanas:', err));
  };

  const fetchMunicipio = () => {
    fetch('/api/municipio')
      .then(res => res.json())
      .then(data => setMunicipio(data))
      .catch(err => console.error('Error fetching municipio:', err));
  };

  const fetchColonia = () => {
    fetch('/api/colonia')
      .then(res => res.json())
      .then(data => setColonia(data))
      .catch(err => console.error('Error fetching colonia:', err));
  };

  useEffect(() => {
    fetchStats();
    fetchReports();
    fetchTomas();
    fetchValvulas();
    fetchTuberias();
    fetchSectores();
    fetchManzanas();
    fetchMunicipio();
    fetchColonia();
  }, []);

  // Pedregalito, Ocoyoacac (Colonia Guadalupe Hidalgo center)
  const mapCenter = [19.2510, -99.4654];

  const [tipoReporte, setTipoReporte] = useState('Fuga de Agua en Vía Pública');
  const [descripcion, setDescripcion] = useState('');
  const [reportLocation, setReportLocation] = useState({ lat: 19.2510, lng: -99.4654 });

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetch('/api/reportes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo_reporte: tipoReporte,
        descripcion: descripcion,
        lat: reportLocation.lat,
        lng: reportLocation.lng,
      }),
    })
    .then(res => res.json())
    .then(data => {
      alert('Reporte registrado exitosamente en la base de datos.');
      setReportModalOpen(false);
      setDescripcion('');
      fetchStats();
    })
    .catch(err => {
      console.error('Error al enviar reporte:', err);
      alert('Error al conectar con el servidor.');
    });
  };

  const toggleValveStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Abierta' ? 'Cerrada' : 'Abierta';
    fetch(`/api/valvulas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado_operativo: newStatus }),
    })
    .then(res => res.json())
    .then(data => {
      // Recargar datos de válvulas
      fetch('/api/valvulas')
        .then(res => res.json())
        .then(data => {
          setValvulas(data);
          fetchStats();
        });
    })
    .catch(err => console.error('Error updating valve status:', err));
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header glass-panel">
        <div className="header-content">
          <div className="logo-container">
            <div className="logo-icon-bg">
              <Droplets className="logo-icon" size={24} />
            </div>
            <div>
              <h1 className="header-title">SIG Red Hidráulica</h1>
              <p className="header-subtitle">Pedregal de Guadalupe Hidalgo</p>
            </div>
          </div>
          
          <div className="header-actions">
            <button className="btn btn-secondary">
              <Search size={18} />
              <span>Buscar</span>
            </button>
            <button className="btn btn-primary" onClick={() => setReportModalOpen(true)}>
              <AlertTriangle size={18} />
              <span>Reportar Fuga</span>
            </button>
            <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Actuar como:</label>
              <select 
                value={currentRole} 
                onChange={(e) => {
                  setCurrentRole(e.target.value);
                  setIsAdmin(e.target.value === 'Administrador');
                }}
                className="form-control"
                style={{ width: 'auto', display: 'inline-block', padding: '0.25rem', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '4px' }}
              >
                <option value="Administrador">Admin</option>
                <option value="Operador de Campo">Operador</option>
                <option value="Ciudadano">Ciudadano</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Sidebar */}
        <aside className="sidebar glass-panel">
          <div className="sidebar-section">
            <h2 className="sidebar-title">Capas de Gestión</h2>
            <ul className="layer-list">
               <li><label><input type="checkbox" checked={showTomas} onChange={(e) => setShowTomas(e.target.checked)} /> Tomas Domiciliarias</label></li>
               <li><label><input type="checkbox" checked={showValvulas} onChange={(e) => setShowValvulas(e.target.checked)} /> Válvulas y Nodos</label></li>
               <li><label><input type="checkbox" checked={showTuberias} onChange={(e) => setShowTuberias(e.target.checked)} /> Red Tuberías</label></li>
            </ul>
          </div>

          <div className="sidebar-section">
            <h2 className="sidebar-title">Límites Administrativos</h2>
            <ul className="layer-list">
              <li><label><input type="checkbox" checked={showMunicipio} onChange={(e) => setShowMunicipio(e.target.checked)} /> Límite Municipal (Ocoyoacac)</label></li>
              <li><label><input type="checkbox" checked={showColonia} onChange={(e) => setShowColonia(e.target.checked)} /> Límite Colonia (Pedregal)</label></li>
               <li><label><input type="checkbox" checked={showSectores} onChange={(e) => setShowSectores(e.target.checked)} /> Sectores de Distribución</label></li>
                <li><label><input type="checkbox" checked={showManzanas} onChange={(e) => setShowManzanas(e.target.checked)} /> Manzanas</label></li>
            </ul>
          </div>

          <div className="sidebar-section">
            <h2 className="sidebar-title">Filtros Avanzados</h2>
            <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Material Tubería:</label>
                <select 
                  className="form-control mt-1" 
                  value={filterMaterial} 
                  onChange={(e) => setFilterMaterial(e.target.value)}
                  style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', width: '100%', borderRadius: '4px', padding: '0.25rem' }}
                >
                  <option value="">Todos los materiales</option>
                  {tuberias && tuberias.features && Array.from(new Set(tuberias.features.map((f: any) => f.properties.material).filter(Boolean))).map((m: any) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Diámetro (Pulgadas):</label>
                <select 
                  className="form-control mt-1" 
                  value={filterDiametro} 
                  onChange={(e) => setFilterDiametro(e.target.value)}
                  style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', width: '100%', borderRadius: '4px', padding: '0.25rem' }}
                >
                  <option value="">Todos los diámetros</option>
                  {tuberias && tuberias.features && Array.from(new Set(tuberias.features.map((f: any) => f.properties.diametro_pulgadas).filter(Boolean))).sort((a: any, b: any) => a - b).map((d: any) => (
                    <option key={d} value={d}>{d}"</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Mantenimiento Válvulas:</label>
                <select 
                  className="form-control mt-1" 
                  value={filterMantenimiento} 
                  onChange={(e) => setFilterMantenimiento(e.target.value)}
                  style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', width: '100%', borderRadius: '4px', padding: '0.25rem' }}
                >
                  <option value="all">Todas las válvulas</option>
                  <option value="reciente">Último año</option>
                  <option value="antiguo">Sin mtto. reciente</option>
                  <option value="ninguno">Sin fecha registrada</option>
                </select>
              </div>
            </div>
          </div>

          {isOperador && (
            <div className="sidebar-section admin-section">
              <h2 className="sidebar-title admin-title">
                <Settings size={16} /> Administración
              </h2>
              {isAdmin && (
                <button 
                  className="btn btn-outline full-width"
                  onClick={() => { fetchUsers(); setUsersModalOpen(true); }}
                >
                  Gestión de Usuarios
                </button>
              )}
              {isAdmin && (
                <button 
                  className="btn btn-outline full-width mt-2"
                  onClick={() => { setImportMessage(''); setImportModalOpen(true); }}
                >
                  Importar Datos (GeoJSON)
                </button>
              )}
              {isAdmin && (
                <button 
                  className="btn btn-outline full-width mt-2"
                  onClick={() => setQgisModalOpen(true)}
                >
                  Integración QGIS
                </button>
              )}
              <button className="btn btn-outline full-width mt-2" onClick={() => { fetchReports(); setReportsModalOpen(true); }}>
                Validar Reportes
              </button>
              <button className="btn btn-outline full-width mt-2" onClick={() => setPostgisModalOpen(true)}>
                <Activity size={16} /> Panel PostGIS
              </button>
            </div>
          )}
        </aside>

        {/* Map Container */}
        <div className="map-wrapper glass-panel">
          <button 
            className="btn btn-primary" 
            style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center' }}
            onClick={() => {
              setSelectedReportId(null);
              if (map) map.flyTo([19.2510, -99.4654], 16);
            }}
          >
            <Droplets size={16} style={{ marginRight: '0.25rem' }} /> Centrar Colonia
          </button>

          {affectedData && (
            <button 
              className="btn btn-secondary" 
              style={{ position: 'absolute', top: '4.5rem', left: '1.5rem', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', borderColor: '#dc2626', color: '#dc2626', background: 'white' }}
              onClick={() => setAffectedData(null)}
            >
              Limpiar Simulación
            </button>
          )}

          {/* Barra de Levantamiento en Campo (Solo Operadores/Admin) */}
          {isOperador && (
            <div 
              style={{ 
                position: 'absolute', 
                top: affectedData ? '7.5rem' : '4.5rem', 
                left: '1.5rem', 
                zIndex: 1000, 
                background: 'rgba(15, 23, 42, 0.85)', 
                backdropFilter: 'blur(10px)',
                padding: '0.75rem', 
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                display: 'flex', 
                flexDirection: 'column',
                gap: '0.5rem',
                maxWidth: '220px'
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textAlign: 'center', marginBottom: '0.25rem' }}>
                LEVANTAMIENTO EN CAMPO
              </div>
              
              <button 
                className={`btn ${drawingType === 'toma' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                onClick={() => { setDrawingType('toma'); setLineVertices([]); }}
              >
                ➕ Nueva Toma
              </button>
              <button 
                className={`btn ${drawingType === 'valvula' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                onClick={() => { setDrawingType('valvula'); setLineVertices([]); }}
              >
                ➕ Nueva Válvula
              </button>
              <button 
                className={`btn ${drawingType === 'tuberia' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                onClick={() => { setDrawingType('tuberia'); setLineVertices([]); }}
              >
                ➕ Nueva Tubería
              </button>

              {drawingType && (
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', textAlign: 'center', marginTop: '0.25rem' }}>
                  {drawingType === 'tuberia' 
                    ? 'Haz clic en el mapa para añadir vértices.' 
                    : 'Haz clic en el mapa para ubicar el elemento.'}
                </div>
              )}

              {drawingType === 'tuberia' && lineVertices.length > 0 && (
                <button 
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', padding: '0.5rem', background: '#10b981', borderColor: '#10b981' }}
                  onClick={() => { setNewFeatureModalOpen(true); }}
                >
                  💾 Guardar ({lineVertices.length} pts)
                </button>
              )}

              {drawingType && (
                <button 
                  className="btn btn-outline"
                  style={{ fontSize: '0.85rem', padding: '0.25rem', borderColor: '#ef4444', color: '#ef4444' }}
                  onClick={() => { setDrawingType(null); setLineVertices([]); }}
                >
                  Cancelar
                </button>
              )}
            </div>
          )}
          <MapContainer 
            center={mapCenter as [number, number]} 
            zoom={16} 
            className="leaflet-map"
            zoomControl={false}
          >
            <MapController 
              setMap={setMap} 
              drawingType={drawingType}
              setDrawingType={setDrawingType}
              lineVertices={lineVertices}
              setLineVertices={setLineVertices}
              setNewFeatureCoords={setNewFeatureCoords}
              setNewFeatureModalOpen={setNewFeatureModalOpen}
            />
            {drawingType === 'tuberia' && lineVertices.length > 0 && (
              <Polyline 
                positions={lineVertices} 
                pathOptions={{ color: '#38bdf8', weight: 4, dashArray: '5, 10' }} 
              />
            )}
            <ZoomControl position="bottomright" />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Mapa Base (Satélite)">
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution='Tiles &copy; Esri'
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Mapa Base (Calles)">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
              </LayersControl.BaseLayer>

              {showTomas && (
                <LayerGroup>
                  {!tomas && (
                    <Marker position={[19.2680, -99.4580]} icon={homeIcon}>
                      <Popup>
                        <div className="popup-content">
                          <h3>Toma: T-1024</h3>
                          <p><strong>Titular:</strong> Juan Pérez</p>
                          <p><strong>Estado:</strong> Funcional</p>
                          <p><strong>Material:</strong> PVC 1/2"</p>
                          <img src="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=200" alt="Evidencia" className="popup-img"/>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  
                  {tomas && tomas.features && tomas.features.map((feature: any) => {
                    const coords = feature.geometry.coordinates;
                    if (!coords || coords.length < 2) return null;
                    return (
                      <Marker 
                        key={feature.id} 
                        position={[coords[1], coords[0]]} 
                        icon={homeIcon}
                      >
                        <Popup>
                          <div className="popup-content">
                            <h3>Toma: {feature.properties.identificador}</h3>
                            <p><strong>Titular:</strong> {feature.properties.titular || 'No registrado'}</p>
                            <p><strong>Estado:</strong> {feature.properties.estado_fisico || 'Desconocido'}</p>
                            <p><strong>Dirección:</strong> {feature.properties.direccion || 'Sin dirección'}</p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </LayerGroup>
              )}

              {showValvulas && (
                <LayerGroup>
                  {!valvulas && (
                    <Marker position={[19.2690, -99.4590]} icon={valveIcon}>
                      <Popup>
                        <div className="popup-content">
                          <h3>Válvula: V-051</h3>
                          <p><strong>Tipo:</strong> Reductora de Presión</p>
                          <p><strong>Estado:</strong> <span className="status-open">Abierta</span></p>
                          <p><strong>Último Mantenimiento:</strong> 15/Oct/2025</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {valvulas && valvulas.features && valvulas.features
                    .filter((feature: any) => {
                      if (filterMantenimiento === 'all') return true;
                      const fecha = feature.properties.fecha_ultimo_mantenimiento;
                      if (!fecha) return filterMantenimiento === 'ninguno';
                      
                      const maintenanceDate = new Date(fecha);
                      const oneYearAgo = new Date();
                      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                      
                      if (filterMantenimiento === 'reciente') return maintenanceDate >= oneYearAgo;
                      if (filterMantenimiento === 'antiguo') return maintenanceDate < oneYearAgo;
                      return true;
                    })
                    .map((feature: any) => {
                    const coords = feature.geometry.coordinates;
                    if (!coords || coords.length < 2) return null;
                    return (
                      <Marker 
                        key={feature.id} 
                        position={[coords[1], coords[0]]} 
                        icon={valveIcon}
                      >
                        <Popup>
                             <div className="popup-content">
                               <h3>Válvula: {feature.properties.identificador}</h3>
                               <p><strong>Estado:</strong> 
                                 <span className={`status-${feature.properties.estado_operativo?.toLowerCase() || 'unknown'}`}>
                                   {feature.properties.estado_operativo || 'Desconocido'}
                                 </span>
                               </p>
                               <p><strong>Profundidad:</strong> {feature.properties.profundidad_m ? `${feature.properties.profundidad_m}m` : 'N/A'}</p>
                               <p><strong>Mantenimiento:</strong> {feature.properties.fecha_ultimo_mantenimiento || 'Sin datos'}</p>
                               
                               {isAdmin && (
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                   <button 
                                     className="btn btn-sm btn-outline mt-2"
                                     onClick={() => toggleValveStatus(feature.id, feature.properties.estado_operativo)}
                                   >
                                     Cambiar a {feature.properties.estado_operativo === 'Abierta' ? 'Cerrada' : 'Abierta'}
                                   </button>
                                   <button 
                                     className="btn btn-sm btn-primary"
                                     style={{ background: '#dc2626', borderColor: '#dc2626' }}
                                     onClick={() => runSimulation(feature.id)}
                                   >
                                     Simular Corte
                                   </button>
                                 </div>
                               )}
                             </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </LayerGroup>
              )}

              {showTuberias && (
                <LayerGroup>
                  {tuberias && (() => {
                    const filtered = {
                      ...tuberias,
                      features: tuberias.features.filter((f: any) => {
                        const matchMaterial = !filterMaterial || f.properties.material === filterMaterial;
                        const matchDiametro = !filterDiametro || String(f.properties.diametro_pulgadas) === String(filterDiametro);
                        return matchMaterial && matchDiametro;
                      })
                    };
                    return (
                      <GeoJSON 
                        key={JSON.stringify(filtered)} 
                        data={filtered} 
                        style={(feature: any) => ({
                          color: feature.properties.diametro_pulgadas > 2 ? '#1d4ed8' : '#2563eb',
                          weight: (feature.properties.diametro_pulgadas * 3.5) || 6,
                          opacity: 0.9
                        })}
                      />
                    );
                  })()}
                </LayerGroup>
              )}

              {showSectores && sectores && (
                <GeoJSON 
                  key={JSON.stringify(sectores)} 
                  data={sectores} 
                  style={{ color: '#ea580c', weight: 2, fillOpacity: 0.1, fillColor: '#ffedd5' }}
                />
              )}

              {showManzanas && manzanas && (
                <GeoJSON 
                  key={JSON.stringify(manzanas)} 
                  data={manzanas} 
                  style={{ color: '#4b5563', weight: 1, fillOpacity: 0.05, fillColor: '#f3f4f6' }}
                />
              )}

              {showMunicipio && municipio && (
                <GeoJSON 
                  key={JSON.stringify(municipio)} 
                  data={municipio} 
                  style={{ color: '#dc2626', weight: 3, fillOpacity: 0, dashArray: '5, 5' }}
                />
              )}

              {showColonia && colonia && (
                <GeoJSON 
                  key={JSON.stringify(colonia)} 
                  data={colonia} 
                  style={{ color: '#059669', weight: 2, fillOpacity: 0.05, fillColor: '#34d399' }}
                />
              )}

              {showReportes && (
                <LayerGroup>
                  {allReports.map((report: any) => (
                    <Marker 
                      key={report.id} 
                      position={[report.lat, report.lng]} 
                      icon={alertIcon}
                    >
                      <Popup>
                        <div className="popup-content">
                          <h3>{report.tipo_reporte}</h3>
                          <p>{report.descripcion}</p>
                          <p><strong>Estado:</strong> {report.estado}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  
                  {selectedReportId && allReports.find((r: any) => r.id === selectedReportId) && (
                    <CircleMarker 
                      center={[
                        allReports.find((r: any) => r.id === selectedReportId).lat, 
                        allReports.find((r: any) => r.id === selectedReportId).lng
                      ]}
                      radius={25}
                      pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3, weight: 2 }}
                    />
                  )}
                </LayerGroup>
              )}
            </LayersControl>

            {postgisResults && postgisResults.geojson && (
              <GeoJSON 
                key={`postgis-results-${JSON.stringify(postgisResults.geojson)}`}
                data={postgisResults.geojson} 
                style={(feature: any) => {
                  if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                    return { color: '#8b5cf6', weight: 3, fillOpacity: 0.3, fillColor: '#8b5cf6' };
                  }
                  return { color: '#8b5cf6', weight: 8, opacity: 0.9, dashArray: '5, 5' };
                }}
                pointToLayer={(feature: any, latlng: any) => {
                  return L.circleMarker(latlng, {
                    radius: 10,
                    fillColor: '#8b5cf6',
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                  });
                }}
                onEachFeature={(feature: any, layer: any) => {
                  layer.bindPopup(`
                    <div class="popup-content">
                      <h3 style="color: #8b5cf6;">${feature.properties.identificador || feature.properties.nombre || 'Resultado'}</h3>
                      <p><strong>Detalle:</strong> ${feature.properties.detalle}</p>
                    </div>
                  `);
                }}
              />
            )}
            {affectedData && (
              <>
                {affectedData.tuberias && (
                  <GeoJSON 
                    key={`affected-pipes-${JSON.stringify(affectedData.tuberias)}`}
                    data={affectedData.tuberias} 
                    style={{ color: '#dc2626', weight: 8, opacity: 0.8, dashArray: '10, 15' }}
                  />
                )}
                {affectedData.tomas && affectedData.tomas.features && affectedData.tomas.features.map((feature: any) => {
                  const coords = feature.geometry.coordinates;
                  if (!coords || coords.length < 2) return null;
                  return (
                    <CircleMarker 
                      key={`affected-toma-${feature.id}`}
                      center={[coords[1], coords[0]]}
                      radius={10}
                      pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.6, weight: 3 }}
                    >
                      <Popup>
                        <div className="popup-content">
                          <h3 style={{ color: '#dc2626' }}>Toma Afectada</h3>
                          <p><strong>ID:</strong> {feature.properties.identificador}</p>
                          <p><strong>Titular:</strong> {feature.properties.titular || 'No registrado'}</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </>
            )}
          </MapContainer>
        </div>

        {stats && (
          <aside className="sidebar-right glass-panel">
            <div className="sidebar-section">
              <h2 className="sidebar-title">Estadísticas de la Red</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Tuberías</span>
                  <span className="stat-value">{stats.longitud_tuberias_km} km</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Fugas Activas</span>
                  <span className="stat-value text-error">{stats.fugas_activas}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Válvulas</span>
                  <div className="stat-subvalues">
                    <span className="text-success">Abiertas: {stats.valvulas.abiertas}</span>
                    <span className="text-error">Cerradas: {stats.valvulas.cerradas}</span>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Tomas</span>
                  <div className="stat-subvalues">
                    <span className="text-success">Activas: {stats.tomas.activo}</span>
                    <span className="text-warning">Irreg.: {stats.tomas.irregular}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <h2>Reportar Fuga o Irregularidad</h2>
            <p className="modal-subtitle">Ayúdanos a mantener la red. Ubica el punto en el mapa y sube evidencia.</p>
            
            <form className="report-form" onSubmit={handleReportSubmit}>
              <div className="form-group">
                <label>Tipo de Reporte</label>
                <select 
                  className="form-control"
                  value={tipoReporte}
                  onChange={(e) => setTipoReporte(e.target.value)}
                >
                  <option>Fuga de Agua en Vía Pública</option>
                  <option>Fuga en Toma Domiciliaria</option>
                  <option>Falta de Suministro</option>
                  <option>Otro</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Ubicación (Coordenadas auto-capturadas)</label>
                <div className="location-picker">
                  <MapPin size={18} /> {reportLocation.lat.toFixed(4)}, {reportLocation.lng.toFixed(4)}
                  <button type="button" className="btn btn-sm btn-outline">Editar en Mapa</button>
                </div>
              </div>

              <div className="form-group">
                <label>Evidencia Fotográfica</label>
                <div className="file-upload">
                  <span>Haz clic para subir foto (Opcional)</span>
                  <input type="file" accept="image/*" />
                </div>
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <textarea 
                  className="form-control" 
                  rows={3} 
                  placeholder="Detalles de la irregularidad..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  required
                ></textarea>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setReportModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Enviar Reporte</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Reports Management Modal */}
      {reportsModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '600px', width: '100%' }}>
            <h2>Gestión de Reportes</h2>
            <p className="modal-subtitle">Administra los reportes de fugas e incidentes ciudadanos.</p>
            
            <div className="reports-list" style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '1rem' }}>
              {allReports.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', margin: '2rem 0' }}>No hay reportes registrados.</p>
              ) : (
                allReports.map((report: any) => (
                  <div key={report.id} className="report-item" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="report-type" style={{ fontWeight: 600, color: '#f8fafc' }}>{report.tipo_reporte}</span>
                      <span className={`status-badge status-${report.estado.toLowerCase().replace(' ', '-')}`} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                        {report.estado}
                      </span>
                    </div>
                    <p className="report-desc" style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0.5rem 0' }}>{report.descripcion}</p>
                    <div className="report-meta" style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '1rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={12} /> {report.lat.toFixed(4)}, {report.lng.toFixed(4)}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={12} /> {new Date(report.fecha_reporte).toLocaleDateString()}</span>
                    </div>
                    <div className="report-actions" style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline" 
                        onClick={() => flyToLocation(report.id, report.lat, report.lng)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem' }}
                      >
                        <MapPin size={14} /> Ver en Mapa
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Cambiar Estado: </label>
                        <select 
                          value={report.estado} 
                          onChange={(e) => updateReportStatus(report.id, e.target.value)}
                          className="form-control"
                          style={{ width: 'auto', display: 'inline-block', marginLeft: '0.5rem', padding: '0.25rem', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '4px' }}
                        >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En Revisión">En Revisión</option>
                        <option value="Resuelto">Resuelto</option>
                        <option value="Descartado">Descartado</option>
                      </select>
                    </div>
                  </div>
                </div>
                ))
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={() => setReportsModalOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Users Management Modal */}
      {usersModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '600px', width: '100%' }}>
            <h2>Gestión de Usuarios</h2>
            <p className="modal-subtitle">Administra los roles y accesos del personal.</p>
            
            <div className="reports-list" style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '1rem' }}>
              {users.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', margin: '2rem 0' }}>No hay usuarios registrados.</p>
              ) : (
                users.map((user: any) => (
                  <div key={user.id} className="report-item" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="report-type" style={{ fontWeight: 600, color: '#f8fafc' }}>{user.nombre_completo}</span>
                      <span className={`status-badge status-${user.rol.toLowerCase().replace(/ /g, '-')}`} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                        {user.rol}
                      </span>
                    </div>
                    <p className="report-desc" style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0.5rem 0' }}>{user.email}</p>
                    <div className="report-actions" style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Cambiar Rol: </label>
                        <select 
                          value={user.rol} 
                          onChange={(e) => updateUserRole(user.id, e.target.value)}
                          className="form-control"
                          style={{ width: 'auto', display: 'inline-block', marginLeft: '0.5rem', padding: '0.25rem', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '4px' }}
                        >
                          <option value="Administrador">Administrador</option>
                          <option value="Operador de Campo">Operador de Campo</option>
                          <option value="Ciudadano">Ciudadano</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={() => setUsersModalOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '500px', width: '100%' }}>
            <h2>Importar Datos Históricos</h2>
            <p className="modal-subtitle">Carga archivos GeoJSON para alimentar la base de datos.</p>
            
            <form onSubmit={handleImportSubmit} style={{ marginTop: '1.5rem' }}>
              <div className="form-group">
                <label>Capa de Destino:</label>
                <select 
                  value={importLayer} 
                  onChange={(e) => setImportLayer(e.target.value)}
                  className="form-control"
                  style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155' }}
                >
                  <option value="tuberias">Red de Tuberías</option>
                  <option value="valvulas">Válvulas y Nodos</option>
                  <option value="tomas">Tomas Domiciliarias</option>
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Archivo GeoJSON:</label>
                <input 
                  type="file" 
                  accept=".geojson,.json" 
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="form-control"
                  style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '0.5rem' }}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ marginTop: '1.5rem', width: '100%' }}
                disabled={!importFile}
              >
                Procesar e Importar
              </button>
            </form>

            {importMessage && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '4px', background: importMessage.startsWith('Error') ? 'rgba(220, 38, 38, 0.2)' : 'rgba(22, 163, 74, 0.2)', border: importMessage.startsWith('Error') ? '1px solid #dc2626' : '1px solid #16a34a', color: '#f8fafc', fontSize: '0.9rem', textAlign: 'center' }}>
                {importMessage}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setImportModalOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Crear Nueva Infraestructura (Levantamiento) */}
      {newFeatureModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '500px', width: '100%' }}>
            <h2>Registrar Nueva Infraestructura</h2>
            <p className="modal-subtitle">Ingresa los detalles del elemento capturado en campo.</p>
            
            <form onSubmit={handleCreateFeature} style={{ marginTop: '1.5rem' }}>
              <div className="form-group">
                <label>Identificador:</label>
                <input 
                  type="text" 
                  value={newIdentificador} 
                  onChange={(e) => setNewIdentificador(e.target.value)}
                  className="form-control"
                  placeholder="Ej. TD-0099 o RT-0099"
                  style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155' }}
                  required
                />
              </div>

              {/* Si es Toma */}
              {(drawingType === 'toma' || (!drawingType && newFeatureCoords && !lineVertices.length)) && (
                <>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>Titular:</label>
                    <input 
                      type="text" 
                      value={newTitular} 
                      onChange={(e) => setNewTitular(e.target.value)}
                      className="form-control"
                      placeholder="Nombre completo"
                      style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155' }}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>Material:</label>
                    <select 
                      value={newMaterialId} 
                      onChange={(e) => setNewMaterialId(e.target.value)}
                      className="form-control"
                      style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155' }}
                    >
                      <option value="1">PVC</option>
                      <option value="2">Manguera Negra</option>
                      <option value="3">Cobre</option>
                      <option value="5">HDP</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>Estado Físico:</label>
                    <select 
                      value={newEstado} 
                      onChange={(e) => setNewEstado(e.target.value)}
                      className="form-control"
                      style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155' }}
                    >
                      <option value="Funcional">Funcional</option>
                      <option value="Dañada">Dañada</option>
                      <option value="Suspendida">Suspendida</option>
                    </select>
                  </div>
                </>
              )}

              {/* Si es Válvula */}
              {drawingType === 'valvula' && (
                <>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>Tipo de Válvula/Nodo:</label>
                    <select 
                      value={newTipoId} 
                      onChange={(e) => setNewTipoId(e.target.value)}
                      className="form-control"
                      style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155' }}
                    >
                      <option value="1">Válvula de Paso</option>
                      <option value="2">Reductor de Presión</option>
                      <option value="3">Hidrante</option>
                      <option value="4">Tanque</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>Estado Operativo:</label>
                    <select 
                      value={newEstado} 
                      onChange={(e) => setNewEstado(e.target.value)}
                      className="form-control"
                      style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155' }}
                    >
                      <option value="Funcional">Abierta</option>
                      <option value="Suspendida">Cerrada</option>
                    </select>
                  </div>
                </>
              )}

              {/* Si es Tubería */}
              {lineVertices.length > 0 && (
                <>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>Material:</label>
                    <select 
                      value={newMaterialId} 
                      onChange={(e) => setNewMaterialId(e.target.value)}
                      className="form-control"
                      style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155' }}
                    >
                      <option value="1">PVC</option>
                      <option value="2">Manguera Negra</option>
                      <option value="3">Cobre</option>
                      <option value="5">HDP</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>Diámetro (Pulgadas):</label>
                    <input 
                      type="number" 
                      step="0.5"
                      value={newDiametro} 
                      onChange={(e) => setNewDiametro(e.target.value)}
                      className="form-control"
                      style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155' }}
                      required
                    />
                  </div>
                </>
              )}

              <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>
                Guardar en Base de Datos
              </button>
            </form>

            <div className="modal-actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => { setNewFeatureModalOpen(false); if(drawingType !== 'tuberia') setDrawingType(null); }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QGIS Integration Modal */}
      {/* QGIS Integration Modal */}
      {qgisModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '600px', width: '100%', background: '#ffffff', color: '#0f172a' }}>
            <h2 style={{ color: '#0f172a' }}>Integración con QGIS (Escritorio)</h2>
            <p className="modal-subtitle" style={{ color: '#475569' }}>Conecta QGIS directamente a la base de datos centralizada.</p>
            
            <div style={{ marginTop: '1.5rem', background: '#f1f5f9', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <h3 style={{ color: '#0284c7', fontSize: '1.1rem', marginBottom: '0.75rem' }}>Parámetros de Conexión PostGIS</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem 0', color: '#475569', width: '120px' }}>Host:</td>
                    <td style={{ padding: '0.5rem 0', color: '#0f172a', fontWeight: 600 }}>localhost</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem 0', color: '#475569' }}>Puerto:</td>
                    <td style={{ padding: '0.5rem 0', color: '#0f172a', fontWeight: 600 }}>5432</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem 0', color: '#475569' }}>Base de Datos:</td>
                    <td style={{ padding: '0.5rem 0', color: '#0f172a', fontWeight: 600 }}>sig_pedregal</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem 0', color: '#475569' }}>Usuario:</td>
                    <td style={{ padding: '0.5rem 0', color: '#0f172a', fontWeight: 600 }}>ricardo</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ color: '#0284c7', fontSize: '1.1rem', marginBottom: '0.75rem' }}>Pasos para Conectar:</h3>
              <ol style={{ paddingLeft: '1.25rem', color: '#1e293b', fontSize: '0.95rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', lineHeight: '1.4' }}>
                <li>Abre <strong>QGIS Desktop</strong>.</li>
                <li>En el menú superior, ve a <strong>Capa</strong> &gt; <strong>Añadir Capa</strong> &gt; <strong>Añadir Capas PostGIS...</strong></li>
                <li>Haz clic en <strong>Nuevo</strong> e ingresa los parámetros de arriba.</li>
                <li>Prueba la conexión y añade las capas: <code>red_tuberias</code>, <code>red_nodos_control</code> y <code>tomas_domiciliarias</code>.</li>
              </ol>
            </div>

            <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: 'rgba(2, 132, 199, 0.1)', borderRadius: '6px', border: '1px solid rgba(2, 132, 199, 0.3)', color: '#0369a1', fontSize: '0.85rem' }}>
              ℹ️ <strong>Sincronización en Tiempo Real:</strong> Cualquier cambio realizado en QGIS se reflejará instantáneamente en este visor web y viceversa.
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={() => setQgisModalOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Panel PostGIS Modal */}
      {postgisModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '800px', width: '100%' }}>
            <h2>Panel de Consultas PostGIS</h2>
            <p className="modal-subtitle">Ejecuta consultas espaciales avanzadas directamente en la base de datos.</p>
            
            <div className="form-group" style={{ marginTop: '1.5rem' }}>
              <label>Selecciona una Consulta Espacial:</label>
              <select 
                value={selectedQuery} 
                onChange={(e) => setSelectedQuery(e.target.value)}
                className="form-control"
                style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155' }}
              >
                <option value="1">Tomas Domiciliarias Aisladas (Sin tubería cercana)</option>
                <option value="2">Conteo de Fugas por Sector Hidrométrico</option>
                <option value="3">Tuberías Principales (&gt; 2 pulgadas)</option>
              </select>
            </div>

            <button 
              type="button" 
              className="btn btn-primary" 
              style={{ marginTop: '1rem', width: '100%' }}
              onClick={() => executePostgisQuery(selectedQuery)}
            >
              Ejecutar Consulta
            </button>

            {postgisResults && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ color: '#8b5cf6' }}>{postgisResults.titulo}</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>{postgisResults.descripcion}</p>
                
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem' }}>ID / Nombre</th>
                        <th style={{ padding: '0.75rem' }}>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {postgisResults.geojson.features.length === 0 ? (
                        <tr>
                          <td colSpan={2} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No se encontraron resultados.</td>
                        </tr>
                      ) : (
                        postgisResults.geojson.features.map((f: any) => (
                          <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '0.75rem', color: '#f8fafc' }}>{f.properties.identificador || f.properties.nombre}</td>
                            <td style={{ padding: '0.75rem', color: '#94a3b8' }}>{f.properties.detalle}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {postgisResults.geojson.features.length > 0 && (
                  <p style={{ color: '#8b5cf6', fontSize: '0.8rem', marginTop: '0.75rem', textAlign: 'center' }}>
                    * Los resultados han sido resaltados en el mapa con color morado.
                  </p>
                )}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => { setPostgisResults(null); setPostgisModalOpen(false); }}
              >
                Limpiar y Cerrar
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setPostgisModalOpen(false)}>Ver en Mapa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
