# Ranked Mechanics Specification

This document derives the Ranked Mode mechanics from first principles, ensuring every mathematical definition serves a specific design goal regarding player psychology and skill modeling.

## 1. Rank Decay

### 1.1. Principle of Neural Maintenance
> **Rationale**: High-level motor skills ("aim") validly degrade without reinforcement ("entropy"), but foundational competence ("muscle memory") is permanent. A ranking system that does not decay inactive high scores does not accurately reflect the player's current readily expressible skill level. Conversely, infinite decay punishes returning players too harshly.

### 1.2. The Decay Formula
We define a **Safety Net** ($I_{\text{floor}}$) representing the "permanent" skill component, and apply decay only to the "volatile" component above it.

**Definitions**:
- $\phi$ (**Phi**): The Scenario-Specific Uncertainty Factor (Default: `1.0`).
- $\lambda$ (**Decay Lambda**): The decay rate constant (`0.05` / day).
- $I_{\text{peak}}$: The highest rank density achieved.
- $I_{\text{current}}$: The last known rank density.

$$ I_{\text{floor}} = I_{\text{peak}} - 2 \cdot \phi $$

**Mechanism**:
Upon initialization, if time elapsed $\Delta t > 24$ hours, we calculate the potential loss via two models and apply the most aggressive one.

1.  **Exponential Model** (The "Half-Life" of Skill):
    *Rationale: Initial loss of fine motor control happens quickly.*
    $$ I_{\text{exp}} = I_{\text{floor}} + (I_{\text{current}} - I_{\text{floor}}) \cdot (0.5)^{\frac{\Delta t}{30}} $$

2.  **Linear Model** (The "Hard Limit"):
    *Rationale: Skill should not theoretically persist "forever" above the floor. We enforce a 90-day saturation.*
    $$ I_{\text{lin}} = I_{\text{current}} - (I_{\text{current}} - I_{\text{floor}}) \cdot \frac{\Delta t}{90} $$

**Final State**:
$$ I_{\text{decayed}} = \max(I_{\text{floor}}, \min(I_{\text{exp}}, I_{\text{lin}})) $$

---

## 2. Rank Rating Calculation

### 2.1. Principle of Linear Perception
> **Rationale**: While score thresholds between ranks ($T_{\text{gold}} \to T_{\text{plat}}$) may be non-linear in raw damage/points, the User's perception of "progress" is linear. A player 50% of the way to the next rank should perceive themselves as exactly `Rank.5`.

### 2.2. Rank Units Formula (Single Score)
We standardize all scores into **Rank Units** ($R$), where integers replace rank names (e.g., Gold=3, Platinum=4).

**Variables**:
- $S$: The raw score achieved.
- $T_i$: The score threshold for Rank Index $i$.
- $\delta$: The progress interpolation ($0.0 \le \delta < 1.0$).

**Unified Logic**:
We define a virtual $T_0 = 0$ for the "Unranked" bottom threshold.
1.  Find the highest rank index $i$ such that $T_i \le S$.
2.  Calculate $\delta$ (Progress):
    $$ \delta = \frac{S - T_i}{T_{i+1} - T_i} $$
3.  Resulting Rank Unit:
    $$ R = i + \delta $$

**Edge Case: Beyond Max Rank**:
If $S$ exceeds the highest defined threshold $T_{\text{max}}$, we define the step size $V$ using the previous rank's width ($V = T_{\text{max}} - T_{\text{max}-1}$) to maintain linear scaling.
$$ R = i_{\text{max}} + \frac{S - T_{\text{max}}}{V} $$

### 2.3. Principle of Consistency Verification
> **Rationale**: A single performance score is noisy ($Score = Skill + Variance$). True Ranks ($I$) should resist volatility. We assert that **3 consecutive consistent plays** are required to "prove" a higher rank to the system, acting as a low-pass filter on score variance.

### 2.4. Identity Evolution (Session Update)
We use an Exponential Moving Average (EMA) to slowly migrate the persistent Identity ($I$) toward the Session Performance ($R_{session}$).

**Formula**:
$$ I_{\text{new}} = I_{\text{old}} + \alpha \cdot (R_{\text{session}} - I_{\text{old}}) $$

**Tuning**:
- $\alpha = 0.15$
- *Note*: While small, this value accumulates. Over 3 plays of identical performance, the user moves $\approx 40\%$ of the gap. Over 10 plays, $\approx 80\%$. This balances "proof of skill" with "responsiveness".

### 2.5. Principle of Hierarchical Aggregation
> **Rationale**: To prevent over-representation of specific aim mechanics (e.g., if a category has 5 scenarios vs 2), we aggregate ranks hierarchically.

**Structure**:
1.  **Scenario Rank**: $R_{scenario}$ (The identity value).
2.  **Subcategory Rank**: $R_{sub} = \text{Average}(R_{scenario} \in \text{Subcategory})$.
3.  **Category Rank**: $R_{cat} = \text{Average}(R_{sub} \in \text{Category})$.
4.  **Overall Rank**: $R_{overall} = \text{Average}(R_{cat})$.

---

## 3. Scenario Selection Protocol: "Strong-Weak-Weak"

**Principle: Targeted Stimuli**  
To maximize neuroplasticity, training must oscillate between "Recovery" (fixing decayed skills) and "Correction" (addressing absolute weaknesses).

A session consists of **3-Scenario Batches**, generated deterministically based on the player's current Identity Map.

#### The Selection Logic
1. **Slot 1: The "Strong" (Recovery)**
    - **Goal**: Re-awaken a high-level skill that has decayed.
    - **Metric**: Maximize `Gap = Peak - Current`.
    - **Tie-Breaker**:
        1. **Higher Peak**: Priority to recovering higher-level skills.
        2. **Alphabetical**: Deterministic fallback.

2. **Slot 2: The "Weak" (Absolute Weakness)**
    - **Goal**: Force improvement on the absolute lowest skill.
    - **Metric**: Minimize `Strength = Current`.
    - **Tie-Breaker**:
        1. **Lower Peak**: Priority to skills that have *never* been good (true weakness vs. decay).
        2. **Alphabetical**: Deterministic fallback.

3. **Slot 3: The "Weak #2" (Reinforcement)**
    - **Goal**: Secondary correction.
    - **Metric**: 2nd Lowest `Strength`.
    - **Diversity Check**: If Slot 2 and Slot 3 share the same **Category** (e.g., both "Static Clicking"), swap Slot 3 with the next lowest strength scenario from a different category, provided the skill difference is marginal (< 1.0 Rank Unit).

**Why Deterministic?**
Randomness is removed to ensure the "Assessment" is strictly measuring the player's worst bottlenecks. If a player fails a scenario, they cannot "re-roll" to get an easier one; they must improve their metrics to change the selection.
