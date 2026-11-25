const APP_NAMES = {
  'com.instagram.android': 'Instagram',
  'com.facebook.katana': 'Facebook',
  'com.facebook.orca': 'Facebook Messenger',
  'com.whatsapp': 'WhatsApp',
  'com.twitter.android': 'Twitter / X',
  'com.google.android.youtube': 'YouTube',
  'com.google.android.gm': 'Gmail',
  'com.google.android.apps.docs': 'Google Docs',
  'com.google.android.apps.docs.editors.docs': 'Google Docs',
  'com.google.android.apps.docs.editors.sheets': 'Google Sheets',
  'com.google.android.apps.docs.editors.slides': 'Google Slides',
  'com.google.android.apps.maps': 'Google Maps',
  'com.google.android.apps.meetings': 'Google Meet',
  'com.google.android.apps.classroom': 'Google Classroom',
  'com.google.android.apps.photos': 'Google Photos',
  'com.google.android.apps.keep': 'Google Keep',
  'com.google.android.apps.tasks': 'Google Tasks',
  'com.google.android.calendar': 'Google Calendar',
  'com.google.android.contacts': 'Contacts',
  'com.google.android.dialer': 'Phone',
  'com.android.chrome': 'Chrome',
  'org.mozilla.firefox': 'Firefox',
  'com.microsoft.office.outlook': 'Outlook',
  'com.microsoft.office.word': 'Microsoft Word',
  'com.microsoft.office.excel': 'Microsoft Excel',
  'com.microsoft.office.powerpoint': 'Microsoft PowerPoint',
  'com.microsoft.teams': 'Microsoft Teams',
  'com.microsoft.emmx': 'Microsoft Edge',
  'com.skype.raider': 'Skype',
  'com.linkedin.android': 'LinkedIn',
  'com.slack': 'Slack',
  'com.trello': 'Trello',
  'com.dropbox.android': 'Dropbox',
  'com.spotify.music': 'Spotify',
  'com.netflix.mediaclient': 'Netflix',
  'com.amazon.mShop.android.shopping': 'Amazon',
  'com.flipkart.android': 'Flipkart',
  'com.snapchat.android': 'Snapchat',
  'com.zhiliaoapp.musically': 'TikTok',
  'com.ss.android.ugc.trill': 'TikTok',
  'org.telegram.messenger': 'Telegram',
  'com.ubercab': 'Uber',
  'com.discord': 'Discord',
  'com.tencent.mm': 'WeChat',
  'com.duolingo': 'Duolingo',
  'com.coursera.android': 'Coursera',
  'com.udacity.android': 'Udacity',
  'com.udemy.android': 'Udemy',
  'com.android.vending': 'Play Store',
  'com.google.android.gms': 'Google Play Services',
  'com.android.settings': 'Settings',
  'com.android.systemui': 'System UI',
  'com.android.launcher': 'Launcher',
  'com.miui.home': 'Home / Launcher',
  'com.miui.notes': 'Notes',
  'com.mi.globalbrowser': 'Mi Browser',
  'com.sec.android.app.sbrowser': 'Samsung Internet',
  'com.sec.android.gallery3d': 'Gallery',
  'com.oppo.launcher': 'Launcher',
  'com.example.workapp': 'Work App',
};

const STOP_WORDS = new Set([
  'com', 'org', 'net', 'io', 'app', 'apps', 'application', 'android',
  'google', 'mobile', 'developer', 'inc', 'ltd', 'llc', 'services', 'beta',
]);

const humanize = (pkg) => {
  if (!pkg) return 'Unknown';
  const tokens = pkg.split('.').filter((t) => t && !STOP_WORDS.has(t.toLowerCase()));
  if (tokens.length === 0) return pkg;
  const parts = tokens.slice(-2);
  return parts.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
};

export const displayAppName = (item) => {
  const pkg = (item?.appPackage || '').toLowerCase();
  const existing = item?.appName || '';
  if (pkg && APP_NAMES[pkg]) return APP_NAMES[pkg];
  if (existing && existing !== item?.appPackage) return existing;
  return humanize(item?.appPackage || existing);
};

export const friendlyAppName = (pkg) => {
  const key = (pkg || '').toLowerCase();
  if (key && APP_NAMES[key]) return APP_NAMES[key];
  return humanize(pkg);
};
