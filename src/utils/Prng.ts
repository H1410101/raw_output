/**
 * Seedable pseudo-random number generator utility.
 * Uses the Mulberry32 algorithm for a good balance of speed and randomness.
 */
export class Prng {
    private _state: number;

    /**
     * Initializes the generator with a seed.
     *
     * @param seed - The seed value to start from.
     */
    public constructor(seed: number) {
        this._state = seed;
    }

    /**
     * Generates a seed from a string (e.g. session ID).
     *
     * @param input - The string to hash into a seed.
     * @returns A 32-bit integer seed.
     */
    public static seedFromString(input: string): number {
        let hash: number = 2166136261;

        for (let i: number = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }

        return hash >>> 0;
    }

    /**
     * Generates a random number between 0 and 1.
     *
     * @returns A float between 0 (inclusive) and 1 (exclusive).
     */
    public nextFloat(): number {
        this._state |= 0;
        this._state = (this._state + 0x6d2b79f5) | 0;

        let hashValue: number = Math.imul(this._state ^ (this._state >>> 15), 1 | this._state);
        hashValue = (hashValue + Math.imul(hashValue ^ (hashValue >>> 7), 61 | hashValue)) | 0;

        return ((hashValue ^ (hashValue >>> 14)) >>> 0) / 4294967296;
    }

    /**
     * Generates a random integer between min and max.
     *
     * @param min - Minimum value (inclusive).
     * @param max - Maximum value (exclusive).
     * @returns A random integer.
     */
    public nextInt(min: number, max: number): number {
        return Math.floor(this.nextFloat() * (max - min)) + min;
    }

    /**
     * Shuffles an array in place using the Fisher-Yates algorithm.
     *
     * @param array - The array to shuffle.
     * @returns The shuffled array.
     */
    public shuffle<T>(array: T[]): T[] {
        for (let i: number = array.length - 1; i > 0; i--) {
            const j: number = this.nextInt(0, i + 1);
            [array[i], array[j]] = [array[j], array[i]];
        }

        return array;
    }
}
