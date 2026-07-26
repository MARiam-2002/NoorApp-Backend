"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDailyChallengeCompleted = isDailyChallengeCompleted;
function isDailyChallengeCompleted(type, targetValue, journey, completedPrayers = []) {
    switch (type) {
        case 'QURAN_PAGES':
            return journey.quranPagesRead >= targetValue;
        case 'ADHKAR':
            return journey.adhkarCompleted;
        case 'SADAQAH':
            return Number(journey.sadaqahAmount) >= targetValue;
        case 'PRAYER':
            return completedPrayers.length >= targetValue;
        default:
            return false;
    }
}
//# sourceMappingURL=challenge-progress.js.map