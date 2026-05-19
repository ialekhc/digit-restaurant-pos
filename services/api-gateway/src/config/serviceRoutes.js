export const upstreamConfig = {
  core: {
    envKey: 'CORE_SERVICE_URL',
    defaultUrl: 'http://localhost:5500'
  },
  vendor: {
    envKey: 'VENDOR_SERVICE_URL',
    defaultUrl: 'http://localhost:5601'
  }
};

export const routeMappings = [
  {
    mountPath: '/api/vendors',
    service: 'vendor'
  },
  {
    mountPath: '/api',
    service: 'core'
  }
];

export const resolveUpstreamUrl = (serviceName) => {
  const config = upstreamConfig[serviceName];
  if (!config) return null;
  return process.env[config.envKey] || config.defaultUrl;
};
