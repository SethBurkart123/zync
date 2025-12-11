import React, { useEffect, useState, useRef } from 'react';
import {
  WeatherData,
  WeatherForecast,
  WeatherUpdate,
  getWeather,
  getForecast,
  listCities,
  streamWeather,
  BridgeRequestError,
  BridgeChannel,
} from '../generated/api';

const WeatherDemo: React.FC = () => {
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamUpdates, setStreamUpdates] = useState<WeatherUpdate[]>([]);
  const channelRef = useRef<BridgeChannel<WeatherUpdate> | null>(null);

  useEffect(() => {
    loadCities();
  }, []);

  const loadCities = async () => {
    try {
      const result = await listCities();
      setCities(result);
      if (result.length > 0) {
        setSelectedCity(result[0]);
      }
    } catch (err) {
      setError('Failed to load cities');
    }
  };

  const loadWeather = async (city: string) => {
    setLoading(true);
    setError(null);
    try {
      const [weatherData, forecastData] = await Promise.all([
        getWeather({ city }),
        getForecast({ city, days: 7 }),
      ]);
      setWeather(weatherData);
      setForecast(forecastData);
    } catch (err) {
      if (err instanceof BridgeRequestError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError('Failed to load weather');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCity) {
      loadWeather(selectedCity);
    }
  }, [selectedCity]);

  const startStreaming = () => {
    if (!selectedCity || isStreaming) return;
    
    setIsStreaming(true);
    setStreamUpdates([]);
    
    const channel = streamWeather({
      city: selectedCity,
      intervalSeconds: 2,
    });
    
    channelRef.current = channel;
    
    channel.subscribe((update) => {
      setStreamUpdates((prev) => [update, ...prev].slice(0, 20));
    });
    
    channel.onError((err) => {
      setError(`Stream error: ${err.message}`);
      setIsStreaming(false);
    });
    
    channel.onClose(() => {
      setIsStreaming(false);
    });
  };

  const stopStreaming = () => {
    if (channelRef.current) {
      channelRef.current.close();
      channelRef.current = null;
    }
    setIsStreaming(false);
  };

  const getConditionEmoji = (condition: string) => {
    const map: Record<string, string> = {
      Sunny: '☀️',
      Cloudy: '☁️',
      Rainy: '🌧️',
      Stormy: '⛈️',
      Foggy: '🌫️',
      Snowy: '❄️',
    };
    return map[condition] || '🌡️';
  };

  return (
    <div>
      <h2 style={styles.heading}>🌤️ Weather Dashboard</h2>
      
      {error && <div style={styles.error}>{error}</div>}
      
      {/* City Selector */}
      <div style={styles.selector}>
        <label style={styles.label}>Select City:</label>
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          style={styles.select}
        >
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
        <button
          onClick={() => loadWeather(selectedCity)}
          style={styles.button}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {/* Current Weather */}
      {weather && (
        <div style={styles.currentWeather}>
          <div style={styles.weatherMain}>
            <span style={styles.emoji}>
              {getConditionEmoji(weather.conditions)}
            </span>
            <div>
              <h3 style={styles.cityName}>{weather.city}</h3>
              <p style={styles.temp}>{weather.temperature}°C</p>
              <p style={styles.conditions}>{weather.conditions}</p>
            </div>
          </div>
          <div style={styles.weatherDetails}>
            <div style={styles.detailItem}>
              <span>💧</span>
              <span>Humidity: {weather.humidity}%</span>
            </div>
            <div style={styles.detailItem}>
              <span>💨</span>
              <span>Wind: {weather.windSpeed} km/h</span>
            </div>
          </div>
        </div>
      )}

      {/* Forecast */}
      <div style={styles.forecastSection}>
        <h3>7-Day Forecast</h3>
        <div style={styles.forecastGrid}>
          {forecast.map((day, index) => (
            <div key={index} style={styles.forecastCard}>
              <p style={styles.forecastDay}>{day.day}</p>
              <span style={styles.forecastEmoji}>
                {getConditionEmoji(day.conditions)}
              </span>
              <p style={styles.forecastTemp}>
                <span style={styles.high}>{day.high}°</span>
                <span style={styles.low}>{day.low}°</span>
              </p>
              <p style={styles.precipitation}>
                💧 {day.precipitationChance}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Streaming Demo */}
      <div style={styles.streamSection}>
        <h3>Live Weather Stream (SSE Demo)</h3>
        <p style={styles.streamDescription}>
          This demonstrates PyBridge's streaming/channel support using Server-Sent Events.
        </p>
        <div style={styles.streamControls}>
          {!isStreaming ? (
            <button onClick={startStreaming} style={styles.streamButton}>
              ▶️ Start Live Updates
            </button>
          ) : (
            <button onClick={stopStreaming} style={styles.stopButton}>
              ⏹️ Stop Updates
            </button>
          )}
          {isStreaming && (
            <span style={styles.liveIndicator}>
              🔴 LIVE
            </span>
          )}
        </div>
        
        <div style={styles.streamLog}>
          {streamUpdates.length === 0 ? (
            <p style={styles.placeholder}>
              Click "Start Live Updates" to begin streaming weather data
            </p>
          ) : (
            streamUpdates.map((update, index) => (
              <div key={index} style={styles.streamItem}>
                <span style={styles.timestamp}>
                  {new Date(update.timestamp).toLocaleTimeString()}
                </span>
                <span style={styles.streamCity}>{update.city}</span>
                <span style={styles.streamTemp}>
                  {getConditionEmoji(update.conditions)} {update.temperature}°C
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  heading: {
    marginBottom: '20px',
    color: '#2c3e50',
  },
  error: {
    background: '#fee',
    color: '#c00',
    padding: '10px 15px',
    borderRadius: '4px',
    marginBottom: '15px',
  },
  selector: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    marginBottom: '20px',
  },
  label: {
    fontWeight: 'bold',
  },
  select: {
    padding: '10px 15px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    minWidth: '200px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '14px',
    background: '#3498db',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  currentWeather: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    padding: '30px',
    borderRadius: '12px',
    marginBottom: '20px',
  },
  weatherMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '20px',
  },
  emoji: {
    fontSize: '64px',
  },
  cityName: {
    fontSize: '24px',
    marginBottom: '5px',
  },
  temp: {
    fontSize: '48px',
    fontWeight: 'bold',
    margin: '5px 0',
  },
  conditions: {
    fontSize: '18px',
    opacity: 0.9,
  },
  weatherDetails: {
    display: 'flex',
    gap: '30px',
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '16px',
  },
  forecastSection: {
    marginBottom: '20px',
  },
  forecastGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '10px',
    marginTop: '15px',
  },
  forecastCard: {
    background: '#f8f9fa',
    padding: '15px',
    borderRadius: '8px',
    textAlign: 'center',
  },
  forecastDay: {
    fontWeight: 'bold',
    marginBottom: '5px',
  },
  forecastEmoji: {
    fontSize: '32px',
    display: 'block',
    margin: '10px 0',
  },
  forecastTemp: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '5px',
  },
  high: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  low: {
    color: '#3498db',
  },
  precipitation: {
    fontSize: '12px',
    color: '#7f8c8d',
  },
  streamSection: {
    background: '#1a1a2e',
    color: '#fff',
    padding: '20px',
    borderRadius: '8px',
  },
  streamDescription: {
    color: '#aaa',
    marginBottom: '15px',
  },
  streamControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    marginBottom: '15px',
  },
  streamButton: {
    padding: '12px 24px',
    fontSize: '14px',
    background: '#27ae60',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  stopButton: {
    padding: '12px 24px',
    fontSize: '14px',
    background: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  liveIndicator: {
    animation: 'pulse 1s infinite',
    fontWeight: 'bold',
  },
  streamLog: {
    background: '#16213e',
    borderRadius: '4px',
    padding: '15px',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  placeholder: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '20px',
  },
  streamItem: {
    display: 'flex',
    gap: '15px',
    padding: '8px 0',
    borderBottom: '1px solid #2a2a4a',
  },
  timestamp: {
    color: '#888',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  streamCity: {
    flex: 1,
    fontWeight: 'bold',
  },
  streamTemp: {
    color: '#f1c40f',
  },
};

export default WeatherDemo;
