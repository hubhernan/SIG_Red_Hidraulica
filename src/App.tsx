import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, LayerGroup, ZoomControl, GeoJSON, useMap, CircleMarker } from 'react-leaflet';
import { AlertTriangle, Droplets, MapPin, Search, Shield, Settings, Activity, Calendar } from 'lucide-react';
import { Icon } from 'leaflet';

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

function MapController({ setMap }: { setMap: (map: any) => void }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      setMap(map);
    }
  }, [map, setMap]);
  return null;
}

function App() {
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(true); // Demo purpose
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

  const fetchStats = () => {
    fetch('http://localhost:3001/api/estadisticas')
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
    fetch('http://localhost:3001/api/reportes')
      .then(res => res.json())
      .then(data => setAllReports(data))
      .catch(err => console.error('Error fetching reports:', err));
  };

  const updateReportStatus = (id: string, newStatus: string) => {
    fetch(`http://localhost:3001/api/reportes/${id}`, {
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

  useEffect(() => {
    fetchStats();
    fetchReports();
    fetch('http://localhost:3001/api/tomas')
      .then(res => res.json())
      .then(data => setTomas(data))
      .catch(err => console.error('Error fetching tomas:', err));

    fetch('http://localhost:3001/api/valvulas')
      .then(res => res.json())
      .then(data => setValvulas(data))
      .catch(err => console.error('Error fetching valvulas:', err));

    fetch('http://localhost:3001/api/tuberias')
      .then(res => res.json())
      .then(data => setTuberias(data))
      .catch(err => console.error('Error fetching tuberias:', err));

    fetch('http://localhost:3001/api/sectores')
      .then(res => res.json())
      .then(data => setSectores(data))
      .catch(err => console.error('Error fetching sectores:', err));

    fetch('http://localhost:3001/api/manzanas')
      .then(res => res.json())
      .then(data => setManzanas(data))
      .catch(err => console.error('Error fetching manzanas:', err));

    fetch('http://localhost:3001/api/municipio')
      .then(res => res.json())
      .then(data => setMunicipio(data))
      .catch(err => console.error('Error fetching municipio:', err));

    fetch('http://localhost:3001/api/colonia')
      .then(res => res.json())
      .then(data => setColonia(data))
      .catch(err => console.error('Error fetching colonia:', err));
  }, []);

  // Pedregalito, Ocoyoacac (Colonia Guadalupe Hidalgo center)
  const mapCenter = [19.2510, -99.4654];

  const [tipoReporte, setTipoReporte] = useState('Fuga de Agua en Vía Pública');
  const [descripcion, setDescripcion] = useState('');
  const [reportLocation, setReportLocation] = useState({ lat: 19.2510, lng: -99.4654 });

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetch('http://localhost:3001/api/reportes', {
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
    fetch(`http://localhost:3001/api/valvulas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado_operativo: newStatus }),
    })
    .then(res => res.json())
    .then(data => {
      // Recargar datos de válvulas
      fetch('http://localhost:3001/api/valvulas')
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
            <div className="user-profile">
              <div className="avatar">
                {isAdmin ? <Shield size={16} /> : <MapPin size={16} />}
              </div>
              <span>{isAdmin ? 'Admin' : 'Usuario'}</span>
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

          {isAdmin && (
            <div className="sidebar-section admin-section">
              <h2 className="sidebar-title admin-title">
                <Settings size={16} /> Administración
              </h2>
              <button className="btn btn-outline full-width">Gestión de Usuarios</button>
              <button className="btn btn-outline full-width mt-2" onClick={() => { fetchReports(); setReportsModalOpen(true); }}>
                Validar Reportes
              </button>
              <button className="btn btn-outline full-width mt-2">
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
          <MapContainer 
            center={mapCenter as [number, number]} 
            zoom={16} 
            className="leaflet-map"
            zoomControl={false}
          >
            <MapController setMap={setMap} />
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
                                 <button 
                                   className="btn btn-sm btn-outline mt-2"
                                   onClick={() => toggleValveStatus(feature.id, feature.properties.estado_operativo)}
                                 >
                                   Cambiar a {feature.properties.estado_operativo === 'Abierta' ? 'Cerrada' : 'Abierta'}
                                 </button>
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
                          color: feature.properties.diametro_pulgadas > 2 ? '#2563eb' : '#3b82f6',
                          weight: feature.properties.diametro_pulgadas || 2,
                          opacity: 0.8
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
    </div>
  );
}

export default App;
