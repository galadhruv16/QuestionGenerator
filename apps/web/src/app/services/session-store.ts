/**
 * Session Cache Store for GroundQ
 *
 * Provides instant in-memory and sessionStorage caching for project resources,
 * topics, questions, and metadata. Eliminates "0 resource error" flashes and
 * redundant network requests on tab navigation.
 */

export interface CachedProjectData {
  project?: any;
  resources?: any[];
  topics?: any[];
  questions?: any[];
  lastUpdated: number;
}

const memoryStore: Record<string, CachedProjectData> = {};
const STORAGE_PREFIX = 'groundq_cache_';

export function getCachedProject(projectId: string): CachedProjectData | null {
  if (memoryStore[projectId]) {
    return memoryStore[projectId];
  }

  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const validated: CachedProjectData = {
          project: parsed.project ?? null,
          resources: Array.isArray(parsed.resources) ? parsed.resources : [],
          topics: Array.isArray(parsed.topics) ? parsed.topics : [],
          questions: Array.isArray(parsed.questions) ? parsed.questions : [],
          lastUpdated: typeof parsed.lastUpdated === 'number' ? parsed.lastUpdated : Date.now(),
        };
        memoryStore[projectId] = validated;
        return validated;
      }
    }
  } catch {
    // Session storage unavailable or invalid
  }

  return null;
}

export function updateProjectCache(
  projectId: string,
  partial: Partial<CachedProjectData>,
): void {
  const existing = getCachedProject(projectId) || { lastUpdated: Date.now() };
  const updated: CachedProjectData = {
    ...existing,
    ...partial,
    lastUpdated: Date.now(),
  };

  memoryStore[projectId] = updated;

  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(updated));
  } catch {
    // Session storage quota or unavailable
  }
}

export function clearProjectCache(projectId: string): void {
  delete memoryStore[projectId];
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${projectId}`);
  } catch {
    // Ignore
  }
}

export function clearAllSessionCaches(): void {
  for (const key of Object.keys(memoryStore)) {
    delete memoryStore[key];
  }
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Ignore
  }
}

export interface PracticeSessionState {
  mode: 'practice' | 'mock';
  selectedAnswers: Record<string, string>;
  freeResponseAnswers: Record<string, string>;
  flaggedQuestionIds: string[];
  visitedQuestionIds: string[];
  verifiedQuestionIds: string[];
  secondsRemaining: number;
  isSubmitted: boolean;
  currentQuestionIndex: number;
  lastUpdated: number;
}

const PRACTICE_PREFIX = 'groundq_practice_';

export function getPracticeSession(projectId: string): PracticeSessionState | null {
  try {
    const raw = sessionStorage.getItem(`${PRACTICE_PREFIX}${projectId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as PracticeSessionState;
      }
    }
  } catch {
    // Session storage unavailable
  }
  return null;
}

export function savePracticeSession(projectId: string, state: PracticeSessionState): void {
  try {
    sessionStorage.setItem(`${PRACTICE_PREFIX}${projectId}`, JSON.stringify(state));
  } catch {
    // Session storage quota or unavailable
  }
}

export function clearPracticeSession(projectId: string): void {
  try {
    sessionStorage.removeItem(`${PRACTICE_PREFIX}${projectId}`);
  } catch {
    // Ignore
  }
}

