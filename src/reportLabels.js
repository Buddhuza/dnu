const headingLabels = {
  'United States': 'US',
  'United Kingdom': 'UK',
  'United Nations': 'UN'
};

export const reportHeadingLabel = name => headingLabels[name] || name;
