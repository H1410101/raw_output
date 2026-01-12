import { describe, it, expect, beforeEach } from "vitest";

describe("Header Symmetry Test", () => {
    beforeEach(async () => {
        document.body.innerHTML = `
        <style>
            .header-aligner {
                display: inline-grid;
                grid-template-columns: 1fr 1fr;
                gap: 2rem;
                align-items: center;
                justify-content: center;
            }
            .difficulty-tabs-container, 
            .holistic-rank-container {
                /* Ensure they don't collapse */
                min-width: 0; 
                display: flex;
                justify-content: center;
                align-items: center;
                border: 1px solid black; /* For visibility in debug */
            }
        </style>
        <div id="app"></div>`;
    });

    it("Difficulty tabs and Rank UI should have equal width with inline-grid 1fr 1fr", () => {
        const difficultyDiv = document.createElement("div");
        difficultyDiv.className = "difficulty-tabs-container";
        difficultyDiv.textContent = "Short";

        const rankDiv = document.createElement("div");
        rankDiv.className = "holistic-rank-container";
        rankDiv.textContent = "Much Longer Content For Rank Information Display";

        const aligner = document.createElement("div");
        aligner.className = "header-aligner";

        aligner.appendChild(difficultyDiv);
        aligner.appendChild(rankDiv);
        document.body.appendChild(aligner);

        const diffWidth = difficultyDiv.getBoundingClientRect().width;
        const rankWidth = rankDiv.getBoundingClientRect().width;

        console.log(`Diff: ${diffWidth}, Rank: ${rankWidth}`);

        expect(diffWidth).toBeGreaterThan(0);
        expect(rankWidth).toBeGreaterThan(0);

        // This is the specific requirement: Equal width based on largest content.
        expect(diffWidth).toBe(rankWidth);
    });
});
