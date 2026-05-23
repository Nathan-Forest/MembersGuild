const S3_BASE = 'https://membersguild-assets.s3.ap-southeast-2.amazonaws.com'

export interface Guide {
  id:              string
  title:           string
  category:        'members' | 'committee' | 'webmaster'
  icon:            string
  description:     string
  s3Key:           string
  supportCategory: string   // maps to support form dropdown
}

export const GUIDES: Guide[] = [
  // ── Members ──────────────────────────────────────────────────────
  {
    id:              'how-to-login',
    title:           'How to Log In',
    category:        'members',
    icon:            '🔐',
    description:     'Access your club member portal for the first time or on a new device.',
    s3Key:           'guides/members/how-to-login.md',
    supportCategory: 'Cannot log in',
  },
  {
    id:              'how-to-reset-password',
    title:           'How to Reset Your Password',
    category:        'members',
    icon:            '🔑',
    description:     'Forgot your password or need to set a new one.',
    s3Key:           'guides/members/how-to-reset-password.md',
    supportCategory: 'Forgot password',
  },
  {
    id:              'how-to-book-session',
    title:           'How to Book a Session',
    category:        'members',
    icon:            '📅',
    description:     'Find and register for upcoming training sessions.',
    s3Key:           'guides/members/how-to-book-session.md',
    supportCategory: 'Cannot book a session',
  },
  {
    id:              'how-to-cancel-session',
    title:           'How to Cancel a Session',
    category:        'members',
    icon:            '❌',
    description:     'Cancel a session booking before it starts.',
    s3Key:           'guides/members/how-to-cancel-session.md',
    supportCategory: 'Cannot book a session',
  },
  {
    id:              'understanding-credits',
    title:           'Understanding Credits',
    category:        'members',
    icon:            '💳',
    description:     'How credits work, how to top up, and what happens when you run out.',
    s3Key:           'guides/members/understanding-credits.md',
    supportCategory: 'Credit balance issue',
  },
  {
    id:              'how-to-use-shop',
    title:           'How to Use the Shop',
    category:        'members',
    icon:            '🛍️',
    description:     'Browse and purchase credit packs and merchandise.',
    s3Key:           'guides/members/how-to-use-shop.md',
    supportCategory: 'Shop or order issue',
  },
  {
    id:              'how-to-update-profile',
    title:           'How to Update Your Profile',
    category:        'members',
    icon:            '👤',
    description:     'Update your personal details, emergency contact, and date of birth.',
    s3Key:           'guides/members/how-to-update-profile.md',
    supportCategory: 'Other',
  },
  // ── Committee ─────────────────────────────────────────────────────
  {
    id:              'recording-attendance',
    title:           'How to Record Attendance',
    category:        'committee',
    icon:            '✅',
    description:     'Mark members as attended, late, NSBA or absent during a session.',
    s3Key:           'guides/committee/recording-attendance.md',
    supportCategory: 'Attendance recording',
  },
  {
    id:              'adding-a-walkin',
    title:           'Adding a Walk-in',
    category:        'committee',
    icon:            '🚶',
    description:     'Register a member who shows up without a prior booking.',
    s3Key:           'guides/committee/adding-a-walkin.md',
    supportCategory: 'Attendance recording',
  },
  {
    id:              'qr-code-checkin',
    title:           'Using QR Code Check-in',
    category:        'committee',
    icon:            '📱',
    description:     'Generate a QR code so members can self check-in at the door.',
    s3Key:           'guides/committee/qr-code-checkin.md',
    supportCategory: 'Attendance recording',
  },
  {
    id:              'managing-shop',
    title:           'Managing the Shop',
    category:        'committee',
    icon:            '🏪',
    description:     'Add products, confirm payments, and manage orders.',
    s3Key:           'guides/committee/managing-shop.md',
    supportCategory: 'Shop or order issue',
  },
  {
    id:              'managing-members',
    title:           'Managing Members',
    category:        'committee',
    icon:            '👥',
    description:     'Add, edit, deactivate members and adjust credit balances.',
    s3Key:           'guides/committee/managing-members.md',
    supportCategory: 'Member management',
  },
  {
    id:              'running-reports',
    title:           'Running Reports',
    category:        'committee',
    icon:            '📊',
    description:     'Generate financial, membership, attendance and training reports.',
    s3Key:           'guides/committee/running-reports.md',
    supportCategory: 'Other',
  },
  // ── Webmaster ─────────────────────────────────────────────────────
  {
    id:              'setting-up-portal',
    title:           'Setting Up Your Club Portal',
    category:        'webmaster',
    icon:            '⚙️',
    description:     'Configure branding, colours, logo and initial club settings.',
    s3Key:           'guides/webmaster/setting-up-portal.md',
    supportCategory: 'Site settings',
  },
  {
    id:              'managing-settings',
    title:           'Managing Site Settings',
    category:        'webmaster',
    icon:            '🔧',
    description:     'Update club settings, welcome emails, credit pricing and more.',
    s3Key:           'guides/webmaster/managing-settings.md',
    supportCategory: 'Site settings',
  },
  {
    id:              'importing-members',
    title:           'Importing Members via CSV',
    category:        'webmaster',
    icon:            '📥',
    description:     'Bulk import existing members using a CSV file.',
    s3Key:           'guides/webmaster/importing-members.md',
    supportCategory: 'Member management',
  },
  {
    id:              'configuring-cats',
    title:           'Configuring the CATS Sign-up Form',
    category:        'webmaster',
    icon:            '📋',
    description:     'Set up the public trial membership sign-up form with custom fields.',
    s3Key:           'guides/webmaster/configuring-cats.md',
    supportCategory: 'Site settings',
  },
  {
    id:              'managing-features',
    title:           'Managing Features',
    category:        'webmaster',
    icon:            '🎛️',
    description:     'Enable or disable portal features for your club.',
    s3Key:           'guides/webmaster/managing-features.md',
    supportCategory: 'Site settings',
  },
]

export const SUPPORT_CATEGORIES = [
  { value: '',                       label: 'Select an issue…' },
  { value: 'Cannot log in',          guideId: 'how-to-login' },
  { value: 'Forgot password',        guideId: 'how-to-reset-password' },
  { value: 'Cannot book a session',  guideId: 'how-to-book-session' },
  { value: 'Credit balance issue',   guideId: 'understanding-credits' },
  { value: 'Shop or order issue',    guideId: 'how-to-use-shop' },
  { value: 'Attendance recording',   guideId: 'recording-attendance' },
  { value: 'Member management',      guideId: 'managing-members' },
  { value: 'Site settings',          guideId: 'managing-settings' },
  { value: 'Other',                  guideId: null },
].map(c => ({
  ...c,
  label: c.label ?? c.value,
  guide: c.guideId ? GUIDES.find(g => g.id === c.guideId) ?? null : null,
}))

export async function fetchGuideContent(s3Key: string): Promise<string> {
  const url = `${S3_BASE}/${s3Key}`
  const res = await fetch(url, {
    next: { revalidate: 3600 }, // cache 1 hour — update S3, live within an hour
  })
  if (!res.ok) return '# Guide not found\n\nThis guide is being written. Check back soon.'
  return res.text()
}

export function getGuidesByCategory(category: Guide['category']) {
  return GUIDES.filter(g => g.category === category)
}

export function getGuideById(id: string) {
  return GUIDES.find(g => g.id === id) ?? null
}