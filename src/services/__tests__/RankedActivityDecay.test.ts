import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RankEstimator } from '../RankEstimator';
import { BenchmarkService } from '../BenchmarkService';
import { IdentityService } from '../IdentityService';

function setupRankEstimatorWithPenalty(scenario: string, penalty: number): RankEstimator {
    const initialMap = {
        [scenario]: {
            continuousValue: 4.0, highestAchieved: 5.0,
            lastUpdated: new Date().toISOString(), penalty,
            lastPlayed: new Date().toISOString(), lastDecayed: new Date().toISOString(),
        }
    };

    localStorage.setItem('rank_identity_state_v2_testuser', JSON.stringify(initialMap));

    return new RankEstimator(new BenchmarkService(), {
        getKovaaksUsername: vi.fn().mockReturnValue("testuser"),
        onProfilesChanged: vi.fn()
    } as unknown as IdentityService);
}

describe('RankEstimator Penalty Lift: Time vs Activity', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });

    it('should NOT lift penalty based on time alone', () => {
        const scenario = 'scenarioA';
        const rankEstimator = setupRankEstimatorWithPenalty(scenario, 2.0);

        // Advance time by 2 days
        vi.setSystemTime(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));

        const estimate = rankEstimator.getScenarioEstimate(scenario);
        expect(estimate.penalty).toBe(2.0);
    });

    it('should lift penalty by 0.5 when applyPenaltyLift is called', () => {
        const scenario = 'scenarioA';
        const rankEstimator = setupRankEstimatorWithPenalty(scenario, 2.0);

        rankEstimator.applyPenaltyLift();

        const map = rankEstimator.getRankEstimateMap();
        expect(map[scenario].penalty).toBe(1.5);
    });
});

describe('RankEstimator Penalty Lift: Daily Constraints', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });

    it('should NOT lift penalty twice on the same day', () => {
        const scenario = 'scenarioA';
        const rankEstimator = setupRankEstimatorWithPenalty(scenario, 2.0);

        rankEstimator.applyPenaltyLift();
        expect(rankEstimator.getRankEstimateMap()[scenario].penalty).toBe(1.5);

        rankEstimator.applyPenaltyLift();
        expect(rankEstimator.getRankEstimateMap()[scenario].penalty).toBe(1.5);
    });

    it('should lift penalty again on a subsequent day', () => {
        const scenario = 'scenarioA';
        const rankEstimator = setupRankEstimatorWithPenalty(scenario, 2.0);

        rankEstimator.applyPenaltyLift();
        expect(rankEstimator.getRankEstimateMap()[scenario].penalty).toBe(1.5);

        // Advance to next day
        vi.setSystemTime(new Date(Date.now() + 24 * 60 * 60 * 1000 + 1000));

        rankEstimator.applyPenaltyLift();
        expect(rankEstimator.getRankEstimateMap()[scenario].penalty).toBe(1.0);
    });

    it('should clamp penalty at 0', () => {
        const scenario = 'scenarioA';
        const rankEstimator = setupRankEstimatorWithPenalty(scenario, 0.2);

        rankEstimator.applyPenaltyLift();
        expect(rankEstimator.getRankEstimateMap()[scenario].penalty).toBe(0);
    });
});
