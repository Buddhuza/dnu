export function contributorFromUser(user) {
  const profile = user?.editorProfile;
  return user?.id && profile ? {
    id: user.id,
    name: String(profile.display_name || 'Editor').slice(0, 80),
    role: profile.role === 'owner' ? 'owner' : 'editor'
  } : null;
}

export function normaliseContributor(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id) return null;
  return {
    id: value.id.slice(0, 80),
    name: String(value.name || 'Editor').slice(0, 80),
    role: value.role === 'owner' ? 'owner' : 'editor'
  };
}

export function contributorHue(value) {
  if (value?.role === 'owner') return 272;
  const palette = [202, 160, 28, 345, 12];
  let hash = 0;
  for (const char of String(value?.id || '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

export function storyAttributionStyle(article, source = 'other') {
  const person = article.editedBy || article.addedBy;
  return { '--story-hue': person ? contributorHue(person) : 210, '--story-opacity': !person ? '.035' : source === 'add' ? '.14' : source === 'import' ? '.10' : source === 'scrape' || source === 'feedrun' ? '.07' : '.06' };
}

export function storySourceLabel(source) {
  return source === 'add' ? 'Add' : source === 'import' ? 'Import' : source === 'scrape' || source === 'feedrun' ? 'Scrape' : 'Earlier edition';
}
