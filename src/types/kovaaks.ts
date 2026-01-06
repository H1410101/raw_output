export interface KovaaksChallengeRun {
  id: string;
  scenarioName: string;
  score: number;
  completionDate: Date;
  difficulty: "Easier" | "Medium" | "Hard" | null;
}
