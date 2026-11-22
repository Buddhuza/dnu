import { isDwLiveBlog } from './dwLiveBlog.js';
import { isSkyUkraineLiveBlog } from './skyLiveBlog.js';
import { isCbsLiveBlog } from './cbsLiveBlog.js';
import { isAlJazeeraLiveBlog } from './alJazeeraLiveBlog.js';
import { isBbcLiveBlog } from './bbcLiveBlog.js';
import { isGuardianLiveBlog } from './guardianLiveBlog.js';
import { isFrance24LiveBlog } from './france24LiveBlog.js';
import { isIndependentLiveBlog } from './independentLiveBlog.js';

const supportedLiveBlogs = [isDwLiveBlog, isSkyUkraineLiveBlog, isCbsLiveBlog,
  isAlJazeeraLiveBlog, isBbcLiveBlog, isGuardianLiveBlog, isFrance24LiveBlog,
  isIndependentLiveBlog];

export function isLiveBlogParentCandidate(item) {
  return !item?.fromLiveBlog && supportedLiveBlogs.some(matches => matches(item?.link));
}
