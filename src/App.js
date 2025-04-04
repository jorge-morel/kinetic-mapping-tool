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
  const [addresses, setAddresses] = useState([]);
  const [error, setError] = useState('');
  const [circleColor, setCircleColor] = useState('red');
  const [dotColor, setDotColor] = useState('black');
  const [tag, setTag] = useState('');
  const [numOfCars, setNumOfCars] = useState('');
  const [showCircle, setShowCircle] = useState(true);
  const [clickedPopup, setClickedPopup] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);

  useEffect(() => {
    fetch("https://kinetic-backend.onrender.com/addresses")
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
      setAddresses([
        ...addresses,
        { address, coordinates: coords, radius, circleColor, dotColor, tag, numOfCars, showCircle },
      ]);
      setAddress('');
      setRadius(5000);
      setTag('');
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

  // 🔹 Click anywhere on the map to see total cars in overlapping areas
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
    tag: item.tag || '',
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
            tag: row.tag || '',
            circleColor: row.circleColor || 'red',
            dotColor: row.dotColor || 'black',
            radius: parseInt(row.radius) || 5000,
            numOfCars: row.numOfCars || '',
            showCircle: row.showCircle !== 'false', // default to true
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
      <header className="App-header">
        <h1>Kinetic market sizing tool</h1>
        <form onSubmit={handleSubmit}>
<input type="file" accept=".csv" onChange={handleCSVUpload} />
<button type="button" onClick={handleExportCSV}>Export to CSV</button>
          <div className="input-options">
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter an address" />
            <input type="number" value={radius} onChange={(e) => setRadius(Number(e.target.value))} min="100" max="10000" placeholder="Radius (m)" disabled={!showCircle} />
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
            <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag (optional)" />
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

              {addresses.map((item, index) => (
                <>
                  {item.showCircle && <Circle key={`circle-${index}`} center={[item.coordinates.lat, item.coordinates.lng]} radius={item.radius} pathOptions={{ fillColor: item.circleColor, color: 'black', fillOpacity: 0.3 }} />}
                  <Marker key={`marker-${index}`} position={[item.coordinates.lat, item.coordinates.lng]} icon={L.divIcon({ className: 'leaflet-div-icon', html: `<div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${item.dotColor};"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] })}>
                    <Popup>
                      {editingIndex === index ? (
                        <>
                          <input type="text" value={item.tag} onChange={(e) => handleEditCircle(index, 'tag', e.target.value)} placeholder="Tag" />
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
                          Cars: {item.numOfCars || 'N/A'}
                          <br />
                          Tag: {item.tag || 'N/A'}
                          <br />
                          <button onClick={() => setEditingIndex(index)}>Edit</button>
                          <button onClick={() => removeAddress(index)}>Remove</button>
                        </>
                      )}
                    </Popup>
                  </Marker>
                </>
              ))}

              {clickedPopup && <Popup position={[clickedPopup.lat, clickedPopup.lng]}><strong>Total cars in area: {clickedPopup.totalCars}</strong></Popup>}
            </MapContainer>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
