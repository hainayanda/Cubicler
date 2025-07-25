import { jest } from '@jest/globals';

// Mock fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock provider service completely
const mockProviderService = {
  getProviders: jest.fn() as jest.MockedFunction<any>,
  getProviderSpec: jest.fn() as jest.MockedFunction<any>,
  loadProviders: jest.fn() as jest.MockedFunction<any>
};

jest.mock('../../src/core/provider-service.js', () => ({
  __esModule: true,
  default: mockProviderService
}));

// Now import the execution service
import executionService from '../../src/core/execution-service.js';

describe('Execution Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();

    // Mock provider list
    mockProviderService.getProviders.mockResolvedValue([
      { name: 'weather_api', description: 'Weather API', spec_source: './tests/mocks/provider-weather-spec.yaml' },
      { name: 'mock_service', description: 'Mock Service', spec_source: './tests/mocks/provider-mock-spec.yaml' }
    ]);

    // Mock provider spec
    mockProviderService.getProviderSpec.mockResolvedValue({
      spec: {
        services: {
          weather_api: {
            base_url: 'https://api.weather.com',
            endpoints: {
              get_weather: {
                method: 'POST',
                path: '/api/weather/{city}/{country}',
                headers: { 'X-Client-Version': 'cubicler/1.0' },
                parameters: { city: { type: 'string' }, country: { type: 'string' } },
                payload: {
                  type: 'object',
                  properties: { filters: { type: 'array', items: { type: 'string' } } }
                }
              }
            }
          }
        },
        functions: {
          getWeather: {
            service: 'weather_api',
            endpoint: 'get_weather',
            description: 'Get weather information by city and country',
            override_parameters: { country: 'US' },
            override_payload: { filters: ['now'] }
          }
        }
      }
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('executeFunction', () => {
    it('should execute provider function successfully', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: '123',
          city: 'New York',
          country: 'US',
          temperature: 20,
          conditions: 'Sunny',
          description: 'Clear sky'
        })
      } as Response);

      const result = await executionService.executeFunction('weather_api.getWeather', {
        city: 'New York'
      });

      expect(result).toEqual({
        id: '123',
        city: 'New York',
        country: 'US',
        temperature: 20,
        conditions: 'Sunny',
        description: 'Clear sky'
      });
    });

    it('should throw error for invalid function name format', async () => {
      await expect(executionService.executeFunction('invalidname', {})).rejects.toThrow(
        "Invalid function name format. Expected 'provider.function', got 'invalidname'"
      );
    });

    it('should throw error when API call fails', async () => {
      // Mock failed API response
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error'
      } as Response);

      await expect(executionService.executeFunction('weather_api.getWeather', {
        city: 'New York'
      })).rejects.toThrow('Failed to call provider function: Internal Server Error');
    });
  });
});
