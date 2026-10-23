const localNames = {
  'Local Sweden': 'Local.se',
  'Local France': 'Local.fr',
  'Local Germany': 'Local.de',
  'Local Spain': 'Local.es',
  'Local Switzerland': 'Local.ch',
  'Local Austria': 'Local.at'
};

export const displaySourceName = name => localNames[name] || name;
