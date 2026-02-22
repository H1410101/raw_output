import { describe, it, expect, beforeEach } from 'vitest';
import { RankEstimator } from '../RankEstimator';
import { BenchmarkService } from '../BenchmarkService';
import { IdentityService } from '../IdentityService';
import { vi } from 'vitest';

describe('RankEstimator Daily Penalty', () => {
    let rankEstimator: RankEstimator;
    const now = new Date();

    beforeEach(() => {
        localStorage.clear();
        const identityService = {
            getKovaaksUsername: vi.fn().mockReturnValue("testuser"),
            onProfilesChanged: vi.fn(),
        } as unknown as IdentityService;
        rankEstimator = new RankEstimator(new BenchmarkService(), identityService);
    });

    it('should apply a 0.05 RU penalty per day', () => {
        const scenario = 'scenarioA';
        const yesterday = new Date(now.getTime() - 24.1 * 60 * 60 * 1000);

        const initialMap = {
            [scenario]: {
                continuousValue: 4.0, highestAchieved: 5.0,
                lastUpdated: yesterday.toISOString(), penalty: 0,
                lastPlayed: yesterday.toISOString(), lastDecayed: yesterday.toISOString(),
            }
        };
        localStorage.setItem('rank_identity_state_v2_testuser', JSON.stringify(initialMap));

        rankEstimator.applyDailyDecay();
        expect(rankEstimator.getRankEstimateMap()[scenario].continuousValue).toBeCloseTo(3.95, 3);
    });
});

describe('RankEstimator Persistence', () => {
    it('should apply penalty even if played today, if not taxed recently', () => {
        localStorage.clear();
        const identityService = {
            getKovaaksUsername: vi.fn().mockReturnValue("testuser"),
            onProfilesChanged: vi.fn(),
        } as unknown as IdentityService;
        const rankEstimator = new RankEstimator(new BenchmarkService(), identityService);
        const twoDaysAgo = new Date(Date.now() - 2.1 * 24 * 60 * 60 * 1000);
        const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);

        const initialMap = {
            scenarioA: {
                continuousValue: 4.0, highestAchieved: 5.0,
                lastUpdated: oneHourAgo.toISOString(), penalty: 0,
                lastPlayed: oneHourAgo.toISOString(), lastDecayed: twoDaysAgo.toISOString(),
            }
        };
        localStorage.setItem('rank_identity_state_v2_testuser', JSON.stringify(initialMap));

        rankEstimator.applyDailyDecay();

        // 4.0 - 2.1 * 0.05 = 4.0 - 0.105 = 3.895
        expect(rankEstimator.getRankEstimateMap().scenarioA.continuousValue).toBeCloseTo(3.895, 3);
    });
});

describe('RankEstimator Floor Constraint', () => {
    it('should respect the floor (peak - 2.0)', () => {
        localStorage.clear();
        const identityService = {
            getKovaaksUsername: vi.fn().mockReturnValue("testuser"),
            onProfilesChanged: vi.fn(),
        } as unknown as IdentityService;
        const rankEstimator = new RankEstimator(new BenchmarkService(), identityService);
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

        const initialMap = {
            scenarioA: {
                continuousValue: 3.05, highestAchieved: 5.0,
                lastUpdated: tenDaysAgo.toISOString(), penalty: 0,
                lastPlayed: tenDaysAgo.toISOString(), lastDecayed: tenDaysAgo.toISOString(),
            }
        };
        localStorage.setItem('rank_identity_state_v2_testuser', JSON.stringify(initialMap));

        rankEstimator.applyDailyDecay();
        expect(rankEstimator.getRankEstimateMap().scenarioA.continuousValue).toBe(3.0);
    });
});

describe('RankEstimator Time Boundaries', () => {
    it('should handle fractional days correctly', () => {
        localStorage.clear();
        const identityService = {
            getKovaaksUsername: vi.fn().mockReturnValue("testuser"),
            onProfilesChanged: vi.fn(),
        } as unknown as IdentityService;
        const rankEstimator = new RankEstimator(new BenchmarkService(), identityService);
        const timeAgo = new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000);

        const initialMap = {
            scenarioA: {
                continuousValue: 4.0, highestAchieved: 5.0,
                lastUpdated: timeAgo.toISOString(), penalty: 0,
                lastPlayed: timeAgo.toISOString(), lastDecayed: timeAgo.toISOString(),
            }
        };
        localStorage.setItem('rank_identity_state_v2_testuser', JSON.stringify(initialMap));

        rankEstimator.applyDailyDecay();
        expect(rankEstimator.getRankEstimateMap().scenarioA.continuousValue).toBeCloseTo(3.925, 3);
    });
});

describe('RankEstimator Min Time', () => {
    it('should not apply penalty if less than 1 day has passed', () => {
        localStorage.clear();
        const identityService = {
            getKovaaksUsername: vi.fn().mockReturnValue("testuser"),
            onProfilesChanged: vi.fn(),
        } as unknown as IdentityService;
        const rankEstimator = new RankEstimator(new BenchmarkService(), identityService);
        const timeAgo = new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000);

        const initialMap = {
            scenarioA: {
                continuousValue: 4.0, highestAchieved: 5.0,
                lastUpdated: timeAgo.toISOString(), penalty: 0,
                lastPlayed: timeAgo.toISOString(), lastDecayed: timeAgo.toISOString(),
            }
        };
        localStorage.setItem('rank_identity_state_v2_testuser', JSON.stringify(initialMap));

        rankEstimator.applyDailyDecay();
        expect(rankEstimator.getRankEstimateMap().scenarioA.continuousValue).toBe(4.0);
    });
});
