import axios from 'axios';

// Google Maps Geocoding API function
export const getCoordinates = async (address) => {
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY; // Get the API key from the .env file

  try {
    const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
      params: {
        address: address,
        key: apiKey,
      },
    });

    // Return latitude and longitude
    if (response.data.status === 'OK') {
      const { lat, lng } = response.data.results[0].geometry.location;
      return { lat, lng };
    } else {
      console.error('Error: Unable to get coordinates');
      return null;
    }
  } catch (error) {
    console.error('Error fetching data from Google Maps API:', error);
    return null;
  }
};
