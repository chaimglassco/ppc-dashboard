# Native campaign attribution capability

The connected tools expose ASIN advertising reports and account-wide campaign reports. The live campaign schema has no `asin_list` filter; no advertised-product mapping endpoint is exposed. Campaign names, targeting rows, and search-term rows cannot reliably establish complete ASIN membership or campaign traffic.

Required provider extension: either an advertised-product endpoint returning stable ASIN → ad-group → campaign IDs with marketplace scope, complete pagination and reporting dates; or a native campaign report supporting ASIN filtering and explicitly confirming the returned ASIN scope. Native campaign data must supply campaign ID/name/type/status and impressions, clicks, spend, sales and orders for each requested period, with complete pagination. Include independent ASIN advertising totals for impressions/clicks/spend/sales/orders and document attribution windows and shared-campaign behavior.

Reconciliation example: `B0DCTX18KK`, US, September 23–29, 2026, compared with September 16–22. Require unique campaign IDs across pages, campaigns active only in one period, native traffic totals, and explicit zero versus missing values. Shared campaigns must be identifiable because their whole-campaign totals can include other products.

Until this capability exists, the application displays the attribution-unavailable message and does not fabricate campaign metrics. The native adapter and analysis domain are prepared for scoped reports; adding a distinct mapping endpoint will require a dedicated adapter implementation and live reconciliation. This request has been prepared locally and has not been sent to the provider.
