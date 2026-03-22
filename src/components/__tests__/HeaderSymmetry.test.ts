import { describe, it, expect, beforeEach } from "vitest";

describe("Header Symmetry Test", () => {
    beforeEach(async (): Promise<void> => {
        document.body.innerHTML = _getHeaderSymmetryHtml();
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

        const alignerStyles = window.getComputedStyle(aligner);
        const difficultyStyles = window.getComputedStyle(difficultyDiv);
        const rankStyles = window.getComputedStyle(rankDiv);

        expect(alignerStyles.display).toBe("inline-grid");
        expect(alignerStyles.gridTemplateColumns).toBe("1fr 1fr");
        expect(difficultyStyles.minWidth).toBe("0");
        expect(rankStyles.minWidth).toBe("0");
    });
});

function _getHeaderSymmetryHtml(): string {
    return `
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
                min-width: 0; 
                display: flex;
                justify-content: center;
                align-items: center;
                border: 1px solid black;
            }
        </style>
        <div id="app"></div>`;
}

