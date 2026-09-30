# Scale Insights API request: exact paid and organic unit totals

Prepared for Scale Insights support; this request has not been sent.

Sales Trend in the portal displays PPC Units and Organic Units, but the MCP tools omit these fields. Please expose the same attribution definitions in `get_sales_data`, using `Summary.TotalPPCUnits`, `Summary.TotalOrganicUnits` and matching fields in `ASINs`, with explicit ASIN, marketplace, date range, coverage, and freshness metadata. Preserve existing `TotalUnits`. Return numeric nonnegative integers, including genuine zero, and null/omitted values for unavailable data.

Reproduction: US, ASIN B0FG4H5C6W, 2026-08-26 through 2026-09-01, mode=raw, group_by=total, summary_only=false, include_growth=false. The live response supplies TotalUnits=65, TotalOrders=59, TotalSales=1317.35 but no paid/organic unit fields. Daily Sales Data and six weekly Sales Trend cycles also omit the split. Ads aggregates and Search Term metrics expose orders, not purchased units.

Please confirm whether another supported read-only MCP endpoint already provides these exact fields, and whether TotalUnits equals PPC Units + Organic Units under the portal's attribution window. Search-term aggregates differ from advertised-product aggregates and cannot substitute for product unit attribution. We need coverage across Sponsored Products, Brands and Display matching the portal, not an order-count or sales-share estimate.

Acceptance: retrieve the portal's exact PPC Units and Organic Units for B0FG4H5C6W and B0DYSBW3X5 for all six Wednesday–Tuesday periods ending 2026-09-29, including zeros and partial periods. No credentials or raw customer data are needed in the reply.
