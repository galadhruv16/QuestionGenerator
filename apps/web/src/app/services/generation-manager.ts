/**
 * Background Generation Manager for GroundQ
 *
 * Keeps active generation runs alive across tab switches. Polls backend status
 * independently of page unmounts, preserves generated count telemetry, and notifies
 * subscribers (Generation Studio, Question Bank) in real time.
 */

import { getSupabaseClient } from '../../lib/supabase';

export interface ActiveGenerationState {
  projectId: string;
  runId: string;
  targetCount: number;
  generatedCount: number;
  status: 'QUEUED' | 'PLANNING' | 'RETRIEVING' | 'GENERATING' | 'VALIDATING' | 'COMPLETED' | 'FAILED';
  step: number;
  error?: string;
  lastQuestionStem?: string;
  lastActiveTopic?: string;
  lastActiveBloom?: string;
  lastUpdated: number;
}

type GenerationSubscriber = (state: ActiveGenerationState) => void;

class GenerationManager {
  private activeRuns: Map<string, ActiveGenerationState> = new Map();
  private subscribers: Map<string, Set<GenerationSubscriber>> = new Map();
  private pollTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl =
      import.meta.env.VITE_API_URL ||
      (import.meta.env.MODE === 'production' ? '' : 'http://localhost:3001');

    // Restore any active runs from sessionStorage
    this.restoreFromStorage();
  }

  private restoreFromStorage() {
    try {
      const raw = sessionStorage.getItem('groundq_active_runs');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, ActiveGenerationState>;
        for (const [projectId, state] of Object.entries(parsed)) {
          if (state && (state.status === 'PLANNING' || state.status === 'RETRIEVING' || state.status === 'GENERATING' || state.status === 'VALIDATING')) {
            this.activeRuns.set(projectId, state);
            this.startPolling(projectId, state.runId);
          } else if (state) {
            this.activeRuns.set(projectId, state);
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  private persistToStorage() {
    try {
      const obj: Record<string, ActiveGenerationState> = {};
      for (const [k, v] of this.activeRuns.entries()) {
        obj[k] = v;
      }
      sessionStorage.setItem('groundq_active_runs', JSON.stringify(obj));
    } catch {
      // Ignore
    }
  }

  public getActiveRun(projectId: string): ActiveGenerationState | null {
    return this.activeRuns.get(projectId) || null;
  }

  public registerRun(projectId: string, runId: string, targetCount: number): ActiveGenerationState {
    const existingTimer = this.pollTimers.get(projectId);
    if (existingTimer) {
      clearInterval(existingTimer);
      this.pollTimers.delete(projectId);
    }

    const state: ActiveGenerationState = {
      projectId,
      runId,
      targetCount,
      generatedCount: 0,
      status: 'PLANNING',
      step: 2,
      lastUpdated: Date.now(),
    };

    this.activeRuns.set(projectId, state);
    this.persistToStorage();
    this.notify(projectId, state);
    this.startPolling(projectId, runId);
    return state;
  }

  public updateState(projectId: string, partial: Partial<ActiveGenerationState>) {
    const existing = this.activeRuns.get(projectId);
    if (!existing) return;

    const updated: ActiveGenerationState = {
      ...existing,
      ...partial,
      lastUpdated: Date.now(),
    };

    this.activeRuns.set(projectId, updated);
    this.persistToStorage();
    this.notify(projectId, updated);
  }

  public subscribe(projectId: string, callback: GenerationSubscriber): () => void {
    if (!this.subscribers.has(projectId)) {
      this.subscribers.set(projectId, new Set());
    }
    this.subscribers.get(projectId)!.add(callback);

    // Call immediately if state exists
    const current = this.activeRuns.get(projectId);
    if (current) {
      callback(current);
    }

    return () => {
      const set = this.subscribers.get(projectId);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.subscribers.delete(projectId);
        }
      }
    };
  }

  private notify(projectId: string, state: ActiveGenerationState) {
    const subs = this.subscribers.get(projectId);
    if (subs) {
      for (const cb of subs) {
        cb(state);
      }
    }
  }

  private startPolling(projectId: string, runId: string) {
    const timer = setInterval(async () => {
      try {
        const { data } = await getSupabaseClient().auth.getSession();
        const token = data.session?.access_token;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const response = await fetch(
          `${this.apiBaseUrl}/api/v1/projects/${projectId}/generation-runs/${runId}`,
          { headers },
        );
        if (!response.ok) return;

        const payload = await response.json();
        const run = payload.data;
        if (!run) return;

        let step = 2;
        if (run.status === 'PLANNING') step = 2;
        else if (run.status === 'RETRIEVING' || run.status === 'GENERATING') step = 3;
        else if (run.status === 'VALIDATING' || run.status === 'COMPLETED' || run.status === 'FAILED') step = 4;

        // Fetch questions count for this run
        let genCount = run.accepted_count ?? 0;
        try {
          const qRes = await fetch(
            `${this.apiBaseUrl}/api/v1/projects/${projectId}/generation-runs/${runId}/questions`,
            { headers },
          );
          if (qRes.ok) {
            const qData = await qRes.json();
            if (Array.isArray(qData.data)) {
              genCount = qData.data.length;
            }
          }
        } catch {
          // Fallback to accepted_count
        }

        const isFinished = run.status === 'COMPLETED' || run.status === 'FAILED';

        this.updateState(projectId, {
          status: run.status,
          step,
          generatedCount: genCount,
          error: run.error_message,
        });

        if (isFinished) {
          clearInterval(timer);
          this.pollTimers.delete(projectId);
        }
      } catch (err) {
        console.error('Error polling generation run:', err);
      }
    }, 1500);

    this.pollTimers.set(projectId, timer);
  }
}

export const generationManager = new GenerationManager();
