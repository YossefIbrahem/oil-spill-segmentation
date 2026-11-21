// All colours and sizes of the app in one place.
export const colors = {
  background: '#07111F',
  card: '#0F1F35',
  cardLight: '#16304F',
  border: 'rgba(148, 197, 255, 0.14)',
  text: '#EAF3FF',
  muted: '#8DA4C2',
  accent: '#22D3EE', // cyan = the oil-spill class colour
  accentDark: '#0891B2',
  danger: '#F87171',
  success: '#34D399',
  warning: '#FBBF24',
};

export const gradients = {
  header: ['#0B3B5C', '#0A2540', '#07111F'] as const,
  button: ['#22D3EE', '#0EA5E9'] as const,
  danger: ['#7F1D1D', '#B91C1C'] as const,
  success: ['#064E3B', '#047857'] as const,
};

export const radius = { sm: 10, md: 16, lg: 22 };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24 };

// Class colours from the dataset. Sea is black, which is invisible on a dark background,
// so the UI draws it with a light outline.
export const CLASSES = [
  { id: 0, name: 'Sea surface', color: '#000000', icon: 'water-outline' },
  { id: 1, name: 'Oil spill', color: '#00FFFF', icon: 'warning-outline' },
  { id: 2, name: 'Look-alike', color: '#FF0000', icon: 'eye-outline' },
  { id: 3, name: 'Ship', color: '#994C00', icon: 'boat-outline' },
  { id: 4, name: 'Land', color: '#009900', icon: 'earth-outline' },
] as const;
