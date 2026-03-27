import { NextResponse } from 'next/server';
import type { WeatherData, ApiResponse } from '@/types/api';

const DEFAULT_LOCATION = 'London';

// Weather condition mappings for ASCII art
const conditionIcons: Record<string, string> = {
  Clear: '☀',
  Sunny: '☀',
  'Partly cloudy': '⛅',
  Cloudy: '☁',
  Overcast: '☁',
  Mist: '🌫',
  Fog: '🌫',
  Rain: '🌧',
  'Light rain': '🌦',
  'Heavy rain': '⛈',
  Snow: '❄',
  'Light snow': '🌨',
  'Heavy snow': '❄',
  Thunderstorm: '⛈',
  Drizzle: '🌦',
};

function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let location = searchParams.get('location');

  try {
    if (!location) {
      // Try IP-based geolocation as fallback
      const forwarded = request.headers.get('x-forwarded-for');
      const realIp = request.headers.get('x-real-ip');
      const ip = forwarded ? forwarded.split(',')[0] : realIp || '';
      const ipLookupUrl = !ip || ip.startsWith('127.') || ip === '::1'
        ? 'https://ipapi.co/json/'
        : `https://ipapi.co/${ip}/json/`;

      try {
        const ipRes = await fetch(ipLookupUrl);
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.city && ipData.region) {
            location = `${ipData.city}, ${ipData.region}`;
          } else if (ipData.region && ipData.country_name) {
            location = `${ipData.region}, ${ipData.country_name}`;
          } else if (ipData.country_name) {
            location = ipData.country_name;
          }
        } else {
          console.warn('IP geolocation returned non-ok status:', ipRes.status, await ipRes.text().catch(()=>'<no body>'));
        }
      } catch (e) {
        console.warn('IP geolocation failed:', e);
      }
    }

    if (!location) {
      // If IP lookup doesn't produce a city/region, fallback to default location (London)
      location = DEFAULT_LOCATION;
      console.warn('No IP location data available, using default location:', DEFAULT_LOCATION);
    }

    let lat: number | null = null, lon: number | null = null, locationName = '';

    // If using default location, use hardcoded London coordinates as fallback
    if (location === DEFAULT_LOCATION) {
      lat = 51.5074;  // London latitude
      lon = -0.1278;  // London longitude
      locationName = DEFAULT_LOCATION;
    } else {
      // Check if location is coordinates (lat,lon format)
      const coordMatch = location.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
      if (coordMatch) {
        lat = parseFloat(coordMatch[1]);
        lon = parseFloat(coordMatch[2]);
        locationName = location;
      } else {
      // Prefer Open-Meteo's geocoding API first (more permissive for server-side use)
      const omUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
      try {
        const omRes = await fetch(omUrl);
        if (omRes.ok) {
          const omData = await omRes.json();
          if (omData && omData.results && omData.results.length > 0) {
            lat = parseFloat(omData.results[0].latitude);
            lon = parseFloat(omData.results[0].longitude);
            locationName = omData.results[0].name || omData.results[0].admin1 || location;
          }
        } else {
          console.warn('Open-Meteo geocoding returned non-ok:', omRes.status, await omRes.text().catch(()=>'<no body>'));
        }
      } catch (e) {
        console.warn('Open-Meteo geocoding failed:', e);
      }

      // If Open-Meteo didn't yield results, fall back to Nominatim
      if (lat == null || lon == null) {
        const geocodeResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`,
          { headers: { 'User-Agent': 'minidash/1.0 (contact@example.com)' } }
        );
        if (!geocodeResponse.ok) {
          const body = await geocodeResponse.text().catch(() => '<unreadable body>');
          console.warn(`Nominatim service unavailable: ${geocodeResponse.status} ${geocodeResponse.statusText} - ${body}`);
        } else {
          const geocodeData = await geocodeResponse.json();
          if (geocodeData && geocodeData.length > 0) {
            lat = parseFloat(geocodeData[0].lat);
            lon = parseFloat(geocodeData[0].lon);
            locationName = geocodeData[0].display_name.split(',')[0]; // Get city name
          }
        }
      }
      
      // Final fallback: if all geocoding failed, use London coordinates
      if (lat == null || lon == null) {
        console.warn(`Could not geocode location "${location}", falling back to London`);
        lat = 51.5074;
        lon = -0.1278;
        locationName = DEFAULT_LOCATION;
      }
      }
    }

    // Use Open-Meteo API (free, no API key required)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,visibility,surface_pressure&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    const response = await fetch(weatherUrl);

    if (!response.ok) {
      const body = await response.text().catch(() => '<unreadable body>');
      throw new Error(`Weather service unavailable: ${response.status} ${response.statusText} - ${body}`);
    }

    const data = await response.json();

    // Map weather codes to conditions
    const weatherCodeMap: Record<number, string> = {
      0: 'Clear',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      56: 'Light freezing drizzle',
      57: 'Dense freezing drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      66: 'Light freezing rain',
      67: 'Heavy freezing rain',
      71: 'Slight snow fall',
      73: 'Moderate snow fall',
      75: 'Heavy snow fall',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail',
    };

    const current = data.current;
    const weatherData: WeatherData = {
      location: locationName,
      current: {
        temp: Math.round(current.temperature_2m),
        feels_like: Math.round(current.apparent_temperature),
        humidity: Math.round(current.relative_humidity_2m),
        wind_speed: Math.round(current.wind_speed_10m),
        wind_direction: getWindDirection(current.wind_direction_10m),
        condition: weatherCodeMap[current.weather_code] || 'Unknown',
        icon: conditionIcons[weatherCodeMap[current.weather_code] || 'Clear'] || '☀',
        visibility: Math.round((current.visibility || 10000) / 1000), // Convert to km
        pressure: Math.round(current.surface_pressure),
      },
      forecast: data.daily.time.slice(0, 5).map((date: string, index: number) => ({
        date,
        high: Math.round(data.daily.temperature_2m_max[index]),
        low: Math.round(data.daily.temperature_2m_min[index]),
        condition: weatherCodeMap[data.daily.weather_code[index]] || 'Unknown',
        icon: conditionIcons[weatherCodeMap[data.daily.weather_code[index]] || 'Clear'] || '☀',
        precipitation: data.daily.precipitation_probability_max[index],
      })),
      lastUpdated: new Date().toISOString(),
    };

    const result: ApiResponse<WeatherData> = {
      data: weatherData,
      error: null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Weather API error:', error);

    const result: ApiResponse<WeatherData> = {
      data: null,
      error: `Unable to fetch weather data: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result, { status: 500 });
  }
}
