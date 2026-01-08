export interface KovaaksChallengeRun {
  runId: string;
  scenarioName: string;
  score: number;
  completionDate: Date;
  difficulty: "Easier" | "Medium" | "Harder" | null;
}
