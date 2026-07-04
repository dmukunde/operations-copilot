/**
 * Data Adapter — abstraction layer for Operations Copilot data sources.
 * Swap SimulatedDataProvider for OutlookProvider, CargoWiseProvider, etc. later.
 */
window.OperationsCopilot = window.OperationsCopilot || {};

(function (OC) {
  'use strict';

  const EMPTY = {
    meta: { mode: 'empty', integrations: {} },
    morningBrief: null,
    inbox: [],
    schedule: [],
    tasks: []
  };

  let provider = null;

  OC.DataAdapter = {
    /** @param {import('./simulatedData').DataProvider} next */
    useProvider(next) {
      provider = next;
    },

    clearProvider() {
      provider = null;
    },

    getMeta() {
      return provider ? provider.getMeta() : EMPTY.meta;
    },

    getMorningBrief() {
      return provider ? provider.getMorningBrief() : null;
    },

    getActionInbox() {
      return provider
        ? provider.getInbox().filter((e) => e.requiresAction)
        : [];
    },

    getFullInbox() {
      return provider ? provider.getInbox() : [];
    },

    getSchedule() {
      return provider ? provider.getSchedule() : [];
    },

    getTasks() {
      return provider ? provider.getTasks() : [];
    },

    getProductivityAnalytics(tasks) {
      if (provider && typeof provider.getAnalytics === 'function') {
        return provider.getAnalytics(tasks);
      }
      return OC.AnalyticsEngine.compute(tasks);
    },

    getExecutiveDashboard(tasks) {
      if (provider && typeof provider.getExecutiveDashboard === 'function') {
        return provider.getExecutiveDashboard(tasks);
      }
      return null;
    },

    isSimulated() {
      return provider ? provider.getMeta().mode === 'simulated' : false;
    }
  };
})(window.OperationsCopilot);
