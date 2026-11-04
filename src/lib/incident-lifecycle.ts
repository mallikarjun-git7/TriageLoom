export type IncidentStatus =
  | "open"
  | "investigating"
  | "mitigating"
  | "resolved";

export const allowedTransitions: Record<
  IncidentStatus,
  readonly IncidentStatus[]
> = {
  open: ["investigating"],
  investigating: ["mitigating"],
  mitigating: ["resolved"],
  resolved: ["investigating"],
};

export function canTransition(
  from: IncidentStatus,
  to: IncidentStatus
): boolean {
  return allowedTransitions[from].includes(to);
}
