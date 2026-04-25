export type Category =
  | 'nature'
  | 'culture'
  | 'gastronomy'
  | 'sport'
  | 'adventure'
  | 'relax'
  | 'fun'
  | 'event';

// Catégories sélectionnables par l'admin/utilisateur dans les formulaires.
// 'institution' n'est PAS une catégorie utilisateur : c'est un tag interne
// utilisé pour tracker les entités à mettre à jour régulièrement (clubs,
// associations) — automatiquement classées comme 'event' pour l'utilisateur.
export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'nature', label: 'Nature' },
  { value: 'culture', label: 'Culture' },
  { value: 'gastronomy', label: 'Gastronomie' },
  { value: 'sport', label: 'Sport' },
  { value: 'adventure', label: 'Aventure' },
  { value: 'relax', label: 'Détente' },
  { value: 'fun', label: 'Fun' },
  { value: 'event', label: 'Événement' },
];

export const FEATURES = [
  'Reservation necessaire',
  'Parking',
  'Horaires restreints',
  'Minimum de participants',
] as const;

export const SEASONS = ['Printemps', 'Été', 'Automne', 'Hiver'] as const;

export const SOCIAL_TAGS = ['Famille', 'Couple', 'Amis', 'Solo'] as const;

export const PRICE_LEVELS: { value: number; label: string }[] = [
  { value: 1, label: 'Gratuit' },
  { value: 2, label: '1-20 CHF' },
  { value: 3, label: '20-50 CHF' },
  { value: 4, label: '50-100 CHF' },
  { value: 5, label: '100+ CHF' },
];

export const CATEGORY_COLORS: Record<string, string> = {
  nature: '#97C45F',
  culture: '#926335',
  gastronomy: '#F6AE2D',
  sport: '#00B8D9',
  adventure: '#FF6F61',
  relax: '#a78bfa',
  fun: '#ec4899',
  event: '#dc2626',
  institution: '#475569',
};

export type Activity = {
  id: number;
  title: string;
  location_name: string;
  description: string | null;
  category: string | null;
  activity_url: string | null;
  image_url: string | null;
  latitude: number;
  longitude: number;
  duration_minutes: number;
  price_level: number | null;
  features: string[] | null;
  seasons: string[] | null;
  social_tags: string[] | null;
  is_indoor: boolean;
  is_outdoor: boolean | null;
  created_at: string;
};

export type ActivitySubmission = Omit<Activity, 'id' | 'created_at'> & {
  id: number;
  submitted_by: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'on_hold';
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
};

export type FeedbackQuestion = {
  id: string;
  questionnaire_type: 'hot' | 'cold';
  order_index: number;
  text: string;
  answer_format: 'rating_5' | 'yes_no' | 'text' | 'multi_choice';
  choices: string[] | null;
  is_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FeedbackSubmission = {
  id: string;
  user_id: string | null;
  activity_id: number | null;
  questionnaire_type: 'hot' | 'cold';
  searches_count: number | null;
  submitted_at: string;
};

export type FeedbackAnswer = {
  id: string;
  submission_id: string;
  question_id: string;
  question_text_snapshot: string;
  question_format_snapshot: string;
  answer_rating: number | null;
  answer_bool: boolean | null;
  answer_text: string | null;
  answer_choice: string | null;
  created_at: string;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'super_admin' | 'admin' | 'editor';
  created_at: string;
};

export type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  login_count: number;
  questionnaires_count: number;
};
