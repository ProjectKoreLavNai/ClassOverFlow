export interface CourseTheme {
  banner: string;     // the course's colour behind its name, with white text on it (flat, never a gradient)
  accent: string;     // the same colour, for marks that belong to the course
  textAccent: string; // a deeper shade of it, for text on white (4.5:1 or better)
}

// The original sage / clay / forest / slate course colours. Each banner holds white text at 4.5:1 or better.
const PALETTE: Record<string, CourseTheme> = {
  sage:   { banner: '#6C7B66', accent: '#6C7B66', textAccent: '#4D5C48' },
  clay:   { banner: '#9C6755', accent: '#9C6755', textAccent: '#855241' },
  forest: { banner: '#2C382F', accent: '#2C382F', textAccent: '#1A241D' },
  slate:  { banner: '#42556A', accent: '#42556A', textAccent: '#263845' },
};

const KNOWN: Record<string, keyof typeof PALETTE> = {
  '3102': 'sage',   // Software Design & Development
  '3101': 'clay',   // Database Systems
  '3104': 'clay',   // Operating Systems
  '3106': 'forest', // Machine Learning
};

const ORDER: Array<keyof typeof PALETTE> = ['sage', 'clay', 'forest', 'slate'];

const hash = (text: string): number => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
};

// The colour is chosen from the course code, so a course looks the same on its card and its page.
// The second argument is kept for older callers and no longer changes the result.
export const getCourseTheme = (course: { code: string; bannerBg?: string }, _index: number = 0): CourseTheme => {
  const code = (course.code || '').toUpperCase();
  const known = Object.keys(KNOWN).find((k) => code.includes(k));
  if (known) return PALETTE[KNOWN[known]];
  return PALETTE[ORDER[hash(code) % ORDER.length]];
};

// People: a stable pale tint per person, hues about 60 degrees apart.
const PERSON_HUES = [20, 80, 140, 190, 230, 340];

export const getPersonTint = (name: string): string =>
  `hsl(${PERSON_HUES[hash((name || '').toLowerCase()) % PERSON_HUES.length]} 40% 90%)`;

export const getInitials = (name: string): string =>
  (name || '')
    .replace(/^(dr|prof)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
