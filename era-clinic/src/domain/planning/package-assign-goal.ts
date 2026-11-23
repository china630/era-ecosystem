/**
 * Package card goal vs board fact — Saxla sync layers.
 * Stepper shows `goal`; gray badge shows `fact`. Draft qty is always goal−fact
 * (never fact+draft summed into the stepper — anti-inflation).
 */
export function packageAssignGoalLayers(input: {
  target: number;
  fact: number;
  kept: number;
}): { goal: number; draft: number; cut: number } {
  const fact = Math.max(0, Math.floor(input.fact));
  const kept = Math.max(0, Math.min(fact, Math.floor(input.kept)));
  const goal = Math.max(kept, Math.max(0, Math.floor(input.target)));
  if (goal > fact) return { goal, draft: goal - fact, cut: 0 };
  if (goal < fact) return { goal, draft: 0, cut: fact - goal };
  return { goal, draft: 0, cut: 0 };
}
