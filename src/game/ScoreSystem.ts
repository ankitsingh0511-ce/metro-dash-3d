export class ScoreSystem {
  score = 0;
  distance = 0;
  coins = 0;
  /** base multiplier grows with distance: x1 .. x5 */
  private multiplierTimer = 0;
  private boosterTimer = 0;

  reset() {
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.multiplierTimer = 0;
    this.boosterTimer = 0;
  }

  setPowerups(multiplierActive: boolean, boosterActive: boolean) {
    this.multiplierTimer = multiplierActive ? 1 : 0;
    this.boosterTimer = boosterActive ? 1 : 0;
  }

  get baseMultiplier(): number {
    return 1 + Math.min(4, Math.floor(this.distance / 800));
  }

  get multiplier(): number {
    return this.baseMultiplier * (this.multiplierTimer ? 2 : 1);
  }

  addDistance(meters: number) {
    this.distance += meters;
    // 1 point per metre, boosted by multiplier; booster adds +50% to run score
    const boost = this.boosterTimer ? 1.5 : 1;
    this.score += meters * this.multiplier * boost;
  }

  addCoin(value = 1) {
    const v = value * (this.boosterTimer ? 2 : 1);
    this.coins += v;
    this.score += 5 * v * this.multiplier;
  }

  get displayScore() {
    return Math.floor(this.score);
  }
}
