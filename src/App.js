import React, { useState, useEffect } from 'react';
import './App.css';
import { getCoordinates } from './geocode';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Papa from 'papaparse';
import kineticIcon from './kinetic-icon.png';

function App() {
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(5000);
  const [overrideRadius, setOverrideRadius] = useState('');
  const [threshold, setThreshold] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [error, setError] = useState('');
  const [circleColor, setCircleColor] = useState('red');
  const [dotColor, setDotColor] = useState('black');
  const [carrier, setCarrier] = useState('');
  const [location, setLocation] = useState('');
  const [numOfCars, setNumOfCars] = useState('');
  const [showCircle, setShowCircle] = useState(true);
  const [clickedPopup, setClickedPopup] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [csvToImport, setCsvToImport] = useState(null);
  const [hubMarkers, setHubMarkers] = useState([]);

  useEffect(() => {
    fetch("https://kinetic-mapping-tool.onrender.com/addresses")
      .then((res) => res.json())
      .then((data) => {
        setAddresses(data);
        updateHubMarkers(data);
      })
      .catch((err) => console.error('Failed to load addresses:', err));
  }, []);

  useEffect(() => {
    if (addresses.length > 0) {
      fetch('https://kinetic-mapping-tool.onrender.com/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addresses),
      }).catch((err) => console.error('Failed to save addresses:', err));
      updateHubMarkers(addresses);
    }
  }, [addresses, threshold]);

  const updateHubMarkers = (data) => {
    if (!threshold) return setHubMarkers([]);
    const thresholdNum = parseInt(threshold);
    const clusters = [];
    const added = new Set();

    for (let i = 0; i < data.length; i++) {
      if (added.has(i)) continue;
      let group = [i];
      let sum = parseInt(data[i].numOfCars) || 0;

      for (let j = 0; j < data.length; j++) {
        if (i !== j && !added.has(j)) {
          const dist = L.latLng(data[i].coordinates).distanceTo(data[j].coordinates);
          if (dist < data[i].radius) {
            group.push(j);
            sum += parseInt(data[j].numOfCars) || 0;
          }
        }
      }

      if (sum > thresholdNum) {
        const avgLat = group.reduce((acc, idx) => acc + data[idx].coordinates.lat, 0) / group.length;
        const avgLng = group.reduce((acc, idx) => acc + data[idx].coordinates.lng, 0) / group.length;
        clusters.push({ lat: avgLat, lng: avgLng });
        group.forEach(idx => added.add(idx));
      }
    }

    setHubMarkers(clusters);
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    setCsvToImport(file);
  };

  const handleConfirmImport = () => {
    if (!csvToImport) return;
    Papa.parse(csvToImport, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const newEntries = [];
        for (const row of results.data) {
          const coords = await getCoordinates(row.address);
          if (coords) {
            newEntries.push({
              address: row.address,
              carrier: row.carrier || '',
              location: row.location || '',
              circleColor: row.circleColor || 'red',
              dotColor: row.dotColor || 'black',
              radius: parseInt(row.radius) || 5000,
              numOfCars: row.numOfCars || '',
              showCircle: row.showCircle !== 'false',
              coordinates: coords,
            });
          }
        }
        setAddresses(newEntries);
        setCsvToImport(null);
      },
      error: (err) => console.error('Error parsing CSV:', err)
    });
  };

  const handleExportCSV = () => {
    const csv = Papa.unparse(addresses);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'addresses.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOverrideRadiusChange = (e) => {
    const value = e.target.value;
    setOverrideRadius(value);
    if (value && !isNaN(value)) {
      const updated = addresses.map((item) => ({ ...item, radius: Number(value) }));
      setAddresses(updated);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const coords = await getCoordinates(address);
    if (coords) {
      const newEntry = {
        address,
        coordinates: coords,
        radius,
        circleColor,
        dotColor,
        carrier,
        location,
        numOfCars,
        showCircle,
      };
      setAddresses([...addresses, newEntry]);
      setAddress('');
      setRadius(5000);
      setCarrier('');
      setLocation('');
      setNumOfCars('');
      setShowCircle(true);
    } else {
      setError('No coordinates found for the given address.');
    }
  };

  const handleEditCircle = (index, field, value) => {
    const updated = [...addresses];
    updated[index][field] = value;
    setAddresses(updated);
  };

  const removeAddress = (index) => {
    setAddresses(addresses.filter((_, i) => i !== index));
  };

  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        let total = 0;
        addresses.forEach((a) => {
          const dist = L.latLng(lat, lng).distanceTo(a.coordinates);
          if (dist <= a.radius && a.numOfCars) {
            total += parseInt(a.numOfCars);
          }
        });
        if (total > 0) setClickedPopup({ lat, lng, totalCars: total });
        else setClickedPopup(null);
      },
    });
    return null;
  };

  return (
       <div className="App">
      <header className="header">
        <div className="top-bar">
          {/* Left Section */}
          <div className="left-panel">
            <input type="file" accept=".csv" onChange={handleCSVUpload} />
            <button onClick={handleConfirmImport}>Import CSV</button>
            <button onClick={handleExportCSV}>Export CSV</button>
            <input
              type="number"
              value={overrideRadius}
              onChange={handleOverrideRadiusChange}
              placeholder="Override Radius"
            />
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="Highlight if cars > X"
            />
          </div>

          {/* Right Section */}
          <form className="right-panel" onSubmit={handleSubmit}>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter address" />
            <input type="number" value={radius} onChange={(e) => setRadius(Number(e.target.value))} min="100" max="10000" placeholder="Radius" />
            <select value={circleColor} onChange={(e) => setCircleColor(e.target.value)}>
              <option value="red">Red</option>
              <option value="orange">Orange</option>
              <option value="yellow">Yellow</option>
              <option value="blue">Blue</option>
              <option value="green">Green</option>
              <option value="purple">Purple</option>
            </select>
            <select value={dotColor} onChange={(e) => setDotColor(e.target.value)}>
              <option value="black">Black</option>
              <option value="purple">Purple</option>
            </select>
            <input type="text" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier" />
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
            <input type="number" value={numOfCars} onChange={(e) => setNumOfCars(e.target.value)} placeholder="# of Cars" />
            <label>
              Show Circle
              <input type="checkbox" checked={showCircle} onChange={(e) => setShowCircle(e.target.checked)} />
            </label>
            <button type="submit">Add Address</button>
          </form>
        </div>
        <div className="hub-count">
          <strong>Potential Kinetic Hubs:</strong> {hubMarkers.length}
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {addresses.length > 0 && (
        <div className="map-container">
          <MapContainer center={[addresses[0].coordinates.lat, addresses[0].coordinates.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapClickHandler />

            {addresses.map((item, index) => (
              <React.Fragment key={index}>
                {item.showCircle && (
                  <Circle
                    center={[item.coordinates.lat, item.coordinates.lng]}
                    radius={item.radius}
                    pathOptions={{ fillColor: item.circleColor, color: 'black', fillOpacity: 0.3 }}
                  />
                )}
                <Marker
                  position={[item.coordinates.lat, item.coordinates.lng]}
                  icon={L.divIcon({
                    className: '',
                    html: `<div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${item.dotColor};"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                  })}
                >
                  <Popup>
                    {editingIndex === index ? (
                      <>
                        <input type="text" value={item.carrier} onChange={(e) => handleEditCircle(index, 'carrier', e.target.value)} placeholder="Carrier" />
                        <input type="text" value={item.location} onChange={(e) => handleEditCircle(index, 'location', e.target.value)} placeholder="Location" />
                        <input type="number" value={item.numOfCars || ''} onChange={(e) => handleEditCircle(index, 'numOfCars', e.target.value)} placeholder="# of Cars" />
                        <input type="number" value={item.radius} onChange={(e) => handleEditCircle(index, 'radius', Number(e.target.value))} />
                        <select value={item.circleColor} onChange={(e) => handleEditCircle(index, 'circleColor', e.target.value)}>
                          <option value="red">Red</option>
                          <option value="orange">Orange</option>
                          <option value="yellow">Yellow</option>
                          <option value="blue">Blue</option>
                          <option value="green">Green</option>
                          <option value="purple">Purple</option>
                        </select>
                        <select value={item.dotColor} onChange={(e) => handleEditCircle(index, 'dotColor', e.target.value)}>
                          <option value="black">Black</option>
                          <option value="purple">Purple</option>
                        </select>
                        <input type="checkbox" checked={item.showCircle} onChange={(e) => handleEditCircle(index, 'showCircle', e.target.checked)} /> Show Circle
                        <button onClick={() => setEditingIndex(null)}>Save</button>
                      </>
                    ) : (
                      <>
                        <strong>{item.address}</strong><br />
                        Cars: {item.numOfCars || 'N/A'}<br />
                        Carrier: {item.carrier || 'N/A'}<br />
                        Location: {item.location || 'N/A'}<br />
                        <button onClick={() => setEditingIndex(index)}>Edit</button>
                        <button onClick={() => removeAddress(index)}>Remove</button>
                      </>
                    )}
                  </Popup>
                </Marker>
              </React.Fragment>
            ))}

            {hubMarkers.map((marker, idx) => (
              <Marker
                key={`hub-${idx}`}
                position={[marker.lat, marker.lng]}
                icon={L.icon({
                  iconUrl: kineticIcon,
                  iconSize: [30, 30],
                  iconAnchor: [15, 15]
                })}
              />
            ))}

            {clickedPopup && (
              <Popup position={[clickedPopup.lat, clickedPopup.lng]}>
                <strong>Total cars in area: {clickedPopup.totalCars}</strong>
              </Popup>
            )}
          </MapContainer>
        </div>
      )}
    </div>

  );
}

export default App;
