import { CLOTHING_CATEGORIES } from '../config/categories.js';

const DEFAULT_HUBER_DELTA = 90;
const LAMBDA_SCALE = 0.08;
const MIN_BILLS_TO_RECOMMEND = 6;

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function sanitizeBillForTraining(bill, categories) {
  if (!bill || bill.excludeFromTrain) return null;
  const actualKg = Number.parseFloat(bill.actualKg);
  if (!Number.isFinite(actualKg) || actualKg <= 0) return null;

  const actualGrams = actualKg * 1000;
  const counts = categories.map((cat) => Math.max(0, Number.parseInt(bill.counts?.[cat.id] ?? 0, 10) || 0));
  const totalItems = counts.reduce((sum, n) => sum + n, 0);
  if (totalItems <= 0) return null;

  const scale = Math.sqrt(totalItems);
  return {
    raw: bill,
    counts,
    totalItems,
    actualGrams,
    scale,
    xScaled: counts.map((n) => n / scale),
    yScaled: actualGrams / scale
  };
}

/**
 * Fits bounded prior-regularized robust regression (WLS + Huber IRLS + Projected Coordinate Descent).
 * Objective: sum_i rho_delta((x_i^T w - y_i)/sqrt(m_i)) + 0.5 * sum_j lambda_j * (w_j - w0_j)^2
 * subject to minGram_j <= w_j <= maxGram_j.
 */
function fitBoundedHuberRidge(records, categories, priors, {
  huberDelta = DEFAULT_HUBER_DELTA,
  lambdaScale = LAMBDA_SCALE,
  irlsIters = 15,
  cdSweeps = 25
} = {}) {
  const kCount = categories.length;
  const w = categories.map((cat) => clamp(priors[cat.id] ?? cat.defaultGram, cat.minGram, cat.maxGram));
  const w0 = [...w];
  const mins = categories.map((cat) => cat.minGram);
  const maxs = categories.map((cat) => cat.maxGram);
  const lambdas = categories.map((cat) => (cat.priorStrength ?? 6) * lambdaScale);

  if (records.length === 0) {
    return { weightsVec: w, irlsWeights: [] };
  }

  const irlsWeights = new Array(records.length).fill(1);
  const residuals = new Float64Array(records.length);

  for (let outer = 0; outer < irlsIters; outer++) {
    // Recompute residuals and Huber weights from current weights
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      let predScaled = 0;
      for (let j = 0; j < kCount; j++) {
        predScaled += rec.xScaled[j] * w[j];
      }
      const err = rec.yScaled - predScaled;
      residuals[i] = err;
      const absErr = Math.abs(err);
      irlsWeights[i] = absErr <= huberDelta ? 1 : huberDelta / absErr;
    }

    for (let sweep = 0; sweep < cdSweeps; sweep++) {
      let maxDelta = 0;

      for (let j = 0; j < kCount; j++) {
        let denom = lambdas[j];
        let numer = lambdas[j] * w0[j];
        const oldW = w[j];

        for (let i = 0; i < records.length; i++) {
          const xij = records[i].xScaled[j];
          if (xij === 0) continue;
          const alpha = irlsWeights[i];
          const partialTarget = residuals[i] + xij * oldW;
          numer += alpha * xij * partialTarget;
          denom += alpha * xij * xij;
        }

        const nextW = denom > 0 ? clamp(numer / denom, mins[j], maxs[j]) : oldW;
        const diff = nextW - oldW;
        if (Math.abs(diff) > 1e-6) {
          w[j] = nextW;
          for (let i = 0; i < records.length; i++) {
            const xij = records[i].xScaled[j];
            if (xij !== 0) residuals[i] -= xij * diff;
          }
          if (Math.abs(diff) > maxDelta) maxDelta = Math.abs(diff);
        }
      }

      if (maxDelta < 1e-3) break;
    }
  }

  return { weightsVec: w, irlsWeights };
}

function predictGrams(countsVec, weightsVec) {
  let sum = 0;
  for (let j = 0; j < weightsVec.length; j++) {
    sum += countsVec[j] * weightsVec[j];
  }
  return sum;
}

function confidenceLevel(appearances) {
  if (appearances >= 10) return 'high';
  if (appearances >= 4) return 'medium';
  return 'low';
}

/**
 * Trains category gram weights from historical aggregate bills and evaluates out-of-sample LOOCV error.
 */
export function trainWeights(bills, {
  categories = CLOTHING_CATEGORIES,
  priors = null,
  minBillsToRecommend = MIN_BILLS_TO_RECOMMEND
} = {}) {
  const effectivePriors = {};
  for (const cat of categories) {
    effectivePriors[cat.id] = clamp(priors?.[cat.id] ?? cat.defaultGram, cat.minGram, cat.maxGram);
  }
  const priorVec = categories.map((cat) => effectivePriors[cat.id]);

  const rawList = Array.isArray(bills) ? bills : [];
  const records = [];
  let excludedCount = 0;

  for (const bill of rawList) {
    const rec = sanitizeBillForTraining(bill, categories);
    if (rec) records.push(rec);
    else excludedCount += 1;
  }

  const { weightsVec: fullWeightsVec, irlsWeights } = fitBoundedHuberRidge(
    records,
    categories,
    effectivePriors
  );

  const weights = {};
  categories.forEach((cat, idx) => {
    weights[cat.id] = clamp(Math.round(fullWeightsVec[idx]), cat.minGram, cat.maxGram);
  });

  // Evaluate out-of-sample performance via Leave-One-Out Cross-Validation (or 10-fold when large)
  let sumDefaultAbsErr = 0;
  let sumDefaultPctErr = 0;
  let sumLoocvAbsErr = 0;
  let sumLoocvPctErr = 0;
  let sumInSampleAbsErr = 0;

  const billDiagnostics = [];
  const useKFold = records.length > 60;
  const numFolds = useKFold ? 10 : records.length;

  const loocvPreds = new Array(records.length);
  if (records.length >= 2) {
    for (let fold = 0; fold < numFolds; fold++) {
      const trainSubset = [];
      const valIndices = [];
      for (let i = 0; i < records.length; i++) {
        const belongsToVal = useKFold ? (i % numFolds) === fold : i === fold;
        if (belongsToVal) valIndices.push(i);
        else trainSubset.push(records[i]);
      }

      const { weightsVec: foldW } = fitBoundedHuberRidge(trainSubset, categories, effectivePriors, {
        irlsIters: 10,
        cdSweeps: 18
      });

      for (const idx of valIndices) {
        loocvPreds[idx] = predictGrams(records[idx].counts, foldW);
      }
    }
  } else if (records.length === 1) {
    loocvPreds[0] = predictGrams(records[0].counts, priorVec);
  }

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const defaultPred = predictGrams(rec.counts, priorVec);
    const inSamplePred = predictGrams(rec.counts, fullWeightsVec);
    const loocvPred = loocvPreds[i];

    const defErr = Math.abs(defaultPred - rec.actualGrams);
    const loocvErr = Math.abs(loocvPred - rec.actualGrams);
    const inErr = Math.abs(inSamplePred - rec.actualGrams);

    sumDefaultAbsErr += defErr;
    sumDefaultPctErr += (defErr / rec.actualGrams) * 100;
    sumLoocvAbsErr += loocvErr;
    sumLoocvPctErr += (loocvErr / rec.actualGrams) * 100;
    sumInSampleAbsErr += inErr;

    billDiagnostics.push({
      id: rec.raw.id || `bill_${i + 1}`,
      date: rec.raw.date || '',
      actualGrams: Math.round(rec.actualGrams),
      defaultPredGrams: Math.round(defaultPred),
      loocvPredGrams: Math.round(loocvPred),
      loocvErrorGrams: Math.round(loocvPred - rec.actualGrams),
      isOutlier: (irlsWeights[i] ?? 1) < 0.8
    });
  }

  const n = records.length;
  const defaultMaeGrams = n > 0 ? Math.round(sumDefaultAbsErr / n) : 0;
  const learnedMaeGrams = n > 0 ? Math.round(sumLoocvAbsErr / n) : 0;
  const inSampleMaeGrams = n > 0 ? Math.round(sumInSampleAbsErr / n) : 0;
  const defaultMapePct = n > 0 ? Number((sumDefaultPctErr / n).toFixed(2)) : 0;
  const learnedMapePct = n > 0 ? Number((sumLoocvPctErr / n).toFixed(2)) : 0;

  const categoryStats = categories.map((cat, idx) => {
    let billAppearances = 0;
    let totalItems = 0;
    for (const rec of records) {
      const qty = rec.counts[idx];
      if (qty > 0) {
        billAppearances += 1;
        totalItems += qty;
      }
    }
    const priorGram = effectivePriors[cat.id];
    const learnedGram = weights[cat.id];
    return {
      id: cat.id,
      name: cat.name,
      billAppearances,
      totalItems,
      priorGram,
      learnedGram,
      deltaGram: learnedGram - priorGram,
      minGram: cat.minGram,
      maxGram: cat.maxGram,
      confidence: confidenceLevel(billAppearances)
    };
  });

  const improved = n >= minBillsToRecommend && learnedMaeGrams <= defaultMaeGrams - 5;

  return {
    validBillsCount: n,
    excludedCount,
    minBillsToRecommend,
    weights,
    priorWeights: effectivePriors,
    defaultMaeGrams,
    learnedMaeGrams,
    inSampleMaeGrams,
    defaultMapePct,
    learnedMapePct,
    improved,
    categoryStats,
    billDiagnostics
  };
}
