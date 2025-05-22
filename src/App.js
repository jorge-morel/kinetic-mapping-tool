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
  const [csvToImport, setCsvToImport] = useState(null);

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
      setAddresses([
        ...addresses,
        { address, coordinates: coords, radius, circleColor, dotColor, carrier, location, numOfCars, showCircle },
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

  const handleOverrideRadiusChange = (e) => {
    const value = e.target.value;
    setOverrideRadius(value);
    if (value && !isNaN(value)) {
      const updated = addresses.map((item) => ({ ...item, radius: Number(value) }));
      setAddresses(updated);
    }
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
        if (totalCars > 0) setClickedPopup({ lat, lng, totalCars });
        else setClickedPopup(null);
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
    setCsvToImport(file);
  };

  const handleConfirmImport = () => {
    if (!csvToImport) return;

    Papa.parse(csvToImport, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;

        const geocodePromises = rows.map(async (row) => {
          const coords = await getCoordinates(row.address);
          if (!coords) return null;
          return {
            address: row.address,
            carrier: row.carrier || '',
            location: row.location || '',
            circleColor: row.circleColor || 'red',
            dotColor: row.dotColor || 'black',
            radius: parseInt(row.radius) || 5000,
            numOfCars: row.numOfCars || '',
            showCircle: row.showCircle !== 'false',
            coordinates: coords,
          };
        });

        const geocodedResults = await Promise.all(geocodePromises);
        const validEntries = geocodedResults.filter(Boolean);

        fetch('https://kinetic-mapping-tool.onrender.com/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validEntries),
        })
          .then(() => setAddresses(validEntries))
          .catch((err) => console.error('Failed to upload CSV data:', err));
      },
      error: (err) => console.error('Error parsing CSV:', err),
    });
  };

  return ( ... );
}

export default App;
