/**
 * Analytics Engine — computes productivity metrics from task data.
 */
window.OperationsCopilot = window.OperationsCopilot || {};

(function (OC) {
  'use strict';

  const HIGH_VALUE_CATEGORIES = new Set(['Shipment', 'Customer', 'Customs', 'Documentation']);
  const LOW_VALUE_CATEGORIES = new Set(['Admin', 'Email']);

  OC.AnalyticsEngine = {
    classifyTask(task) {
      if (task.valueTier) return task.valueTier;
      if (task.priority === 'High' || HIGH_VALUE_CATEGORIES.has(task.category)) return 'high';
      if (LOW_VALUE_CATEGORIES.has(task.category) && task.priority === 'Low') return 'low';
      return 'medium';
    },

    compute(tasks) {
      const buckets = { high: 0, medium: 0, low: 0 };
      const byCategory = {};

      tasks.forEach((t) => {
        const tier = this.classifyTask(t);
        buckets[tier] += t.estimatedMinutes;
        byCategory[t.category] = (byCategory[t.category] || 0) + t.estimatedMinutes;
      });

      const total = buckets.high + buckets.medium + buckets.low || 1;
      const highPct = Math.round((buckets.high / total) * 100);
      const lowPct = Math.round((buckets.low / total) * 100);

      let insight = 'Balance looks healthy between operational and admin work.';
      if (lowPct > 40) insight = 'Over 40% of planned time is low-value admin — batch and defer where possible.';
      else if (highPct > 65) insight = 'Day is heavily weighted toward high-value ops — protect focus blocks.';
      else if (highPct < 35) insight = 'Consider reprioritizing — high-value operational work is underrepresented.';

      return {
        highValueMinutes: buckets.high,
        mediumValueMinutes: buckets.medium,
        lowValueMinutes: buckets.low,
        highValuePercent: highPct,
        lowValuePercent: lowPct,
        byCategory,
        insight
      };
    }
  };
})(window.OperationsCopilot);
