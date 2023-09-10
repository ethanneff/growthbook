import { MetricOverride } from "back-end/types/experiment";
import { SettingsResolver, Settings, ScopeDefinition } from "../types";

export default function genMetricOverrideResolver(
  fieldName: keyof Omit<MetricOverride, "id">
): SettingsResolver<Settings[keyof Settings]> {
  return (ctx) => {
    const metricOverride = ctx.scopes?.experiment?.metricOverrides?.find(
      (mo) => mo.id === ctx.scopes?.metric?.id
    );

    const value =
      metricOverride?.[fieldName] ??
      ctx.scopes?.metric?.[fieldName] ??
      (fieldName === "regressionAdjustmentEnabled"
        ? ctx.scopes?.experiment?.[fieldName]
        : null) ??
      null;

    let scopeApplied: keyof ScopeDefinition | "organization" = "organization";
    let reason = "org-level setting applied";

    if (typeof metricOverride?.[fieldName] !== "undefined") {
      scopeApplied = "experiment";
      reason = "experiment-level metric override applied";
    } else if (typeof ctx.scopes?.metric?.[fieldName] !== "undefined") {
      scopeApplied = "metric";
      reason = "metric-level setting applied";
    } else if (
      fieldName === "regressionAdjustmentEnabled" &&
      typeof ctx.scopes?.experiment?.[fieldName] !== "undefined"
    ) {
      scopeApplied = "experiment";
      reason = "experiment-level setting applied";
    }

    return {
      value,
      meta: {
        scopeApplied,
        reason,
      },
    };
  };
}
