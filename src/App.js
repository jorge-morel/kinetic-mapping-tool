import React, { useState, useEffect } from 'react';
import './App.css';
import { getCoordinates } from './geocode';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Papa from 'papaparse';

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

  useEffect(() => {
    fetch("https://kinetic-mapping-tool.onrender.com/addresses")
      .then((res) => res.json())
      .then((data) => setAddresses(data))
      .catch((err) => console.error('Failed to load addresses:', err));
  }, []);

  useEffect(() => {
    if (addresses.length > 0) {
      fetch('https://kinetic-mapping-tool.onrender.com/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addresses),
      }).catch((err) => console.error('Failed to save addresses:', err));
    }
  }, [addresses]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const coords = await getCoordinates(address);
    if (coords) {
      const circleRad = overrideRadius ? Number(overrideRadius) : radius;
      setAddresses([
        ...addresses,
        { address, coordinates: coords, radius: circleRad, circleColor, dotColor, carrier, location, numOfCars, showCircle },
      ]);
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

  const removeAddress = (index) => {
    setAddresses(addresses.filter((_, i) => i !== index));
  };

  const handleEditCircle = (index, field, value) => {
    const updatedAddresses = [...addresses];
    updatedAddresses[index][field] = value;
    setAddresses(updatedAddresses);
  };

  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        const { lat, lng } = e.latlng;
        let totalCars = 0;

        addresses.forEach((item) => {
          const distance = L.latLng(lat, lng).distanceTo(L.latLng(item.coordinates.lat, item.coordinates.lng));
          if (distance <= item.radius && item.numOfCars) {
            totalCars += parseInt(item.numOfCars, 10);
          }
        });

        if (totalCars > 0) {
          setClickedPopup({ lat, lng, totalCars });
        } else {
          setClickedPopup(null);
        }
      },
    });
    return null;
  };

  const handleExportCSV = () => {
    if (addresses.length === 0) return;

    const dataToExport = addresses.map((item) => ({
      address: item.address,
      carrier: item.carrier || '',
      location: item.location || '',
      circleColor: item.circleColor || 'red',
      dotColor: item.dotColor || 'black',
      radius: item.radius || 5000,
      numOfCars: item.numOfCars || '',
      showCircle: item.showCircle !== false,
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'addresses.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
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

        setAddresses((prev) => [...prev, ...newEntries]);
      },
      error: (err) => {
        console.error('Error parsing CSV:', err);
      },
    });
  };

  return (
    <div className="App">
      <header className="header">
        <h1>Kinetic Market Sizing Tool</h1>
        <form onSubmit={handleSubmit}>
          <input type="file" accept=".csv" onChange={handleCSVUpload} />
          <button type="button" onClick={handleExportCSV}>Export to CSV</button>
          <div className="input-options">
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter an address" />
            <input type="number" value={radius} onChange={(e) => setRadius(Number(e.target.value))} min="100" max="10000" placeholder="Radius (m)" disabled={!showCircle} />
            <input type="number" value={overrideRadius} onChange={(e) => setOverrideRadius(e.target.value)} placeholder="Override All Radii (optional)" />
            <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="Highlight if cars > X" />
            <select value={circleColor} onChange={(e) => setCircleColor(e.target.value)} disabled={!showCircle}>
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
            <input type="text" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier (optional)" />
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" />
            <input type="number" value={numOfCars} onChange={(e) => setNumOfCars(e.target.value)} placeholder="# of Cars" />
            <label>
              Show Circle:
              <input type="checkbox" checked={showCircle} onChange={(e) => setShowCircle(e.target.checked)} />
            </label>
            <button type="submit">Add Address</button>
          </div>
        </form>

        {error && <p className="error">{error}</p>}

        {addresses.length > 0 && (
          <div className="map-container">
            <MapContainer center={[addresses[0].coordinates.lat, addresses[0].coordinates.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler />

              {addresses.map((item, index) => {
                const highlightColor = threshold && item.numOfCars && parseInt(item.numOfCars) > parseInt(threshold) ? '#7e3794' : item.circleColor;

                return (
                  <React.Fragment key={index}>
                    {item.showCircle && (
                      <Circle center={[item.coordinates.lat, item.coordinates.lng]} radius={item.radius} pathOptions={{ fillColor: highlightColor, color: 'black', fillOpacity: 0.3 }} />
                    )}
                    <Marker position={[item.coordinates.lat, item.coordinates.lng]} icon={L.divIcon({ className: '', html: `<div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${item.dotColor};"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] })}>
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
                            <strong>{item.address}</strong>
                            <br />
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
                );
              })}

              {clickedPopup && <Popup position={[clickedPopup.lat, clickedPopup.lng]}><strong>Total cars in area: {clickedPopup.totalCars}</strong></Popup>}
            </MapContainer>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
