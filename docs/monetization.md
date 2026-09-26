# GeoDom monetization model

This document records the current frontend product direction. Billing, contracts, lead delivery and analytics pipelines are not implemented in this repository yet.

## GeoDom Pro for realtors and agencies

GeoDom Pro is a SaaS workspace for finding qualified demand rather than another generic listing feed.

A lead profile can include:

- purchase or rental budget;
- preferred districts;
- room count;
- workplace and maximum commute;
- infrastructure priorities such as schools, parks, transport or dog walking;
- interaction history with apartments.

The realtor sees how strongly a lead matches one of the realtor's listings. Contact information must only become available when the user explicitly agreed that matched professionals may contact them. Production must record the consent event and support revocation.

The frontend demo at `/pro` uses synthetic leads and fake phone numbers only.

## Paid listing promotion

Owners and realtors can pay for an explicitly marked sponsored slot.

Important product rule: paid promotion **must not mutate the GeoDom recommendation score**. Sponsored placement and organic personalized ranking are separate surfaces. Every promoted card is labeled `Продвижение`.

The current frontend demo stores promotion selection locally. No money is charged.

## Qualified developer leads

A developer can pay for demand that already matches a residential complex by:

- budget;
- commute constraints;
- infrastructure priorities;
- district/location;
- apartment parameters.

Commercial hypothesis: roughly 500–3000 RUB per qualified lead, with actual pricing to be validated later.

## Developer B2B workspace

Planned bundle:

- verified developer badge;
- residential-complex page;
- apartment inventory;
- qualified leads;
- paid promotion;
- demand analytics;
- competitor comparison.

The current `/pro` screen contains a frontend-only demo of this workspace.

## GeoDom Analytics

Aggregated demand product:

- what users search for;
- where they search;
- budget distribution;
- preferred districts;
- rejected options;
- desired room count;
- workplace destinations;
- important infrastructure;
- competing residential complexes.

Production analytics should be aggregated/de-identified. Do not expose individual user profiles to analytics customers, and use minimum cohort thresholds before showing fine-grained slices.

## Finance tools

Apartment detail contains two decision tools:

1. mortgage calculator based on a dated public snapshot of Krasnoyarsk bank offers;
2. buy-vs-rent scenario model.

Neither tool is a bank offer or personal financial advice. Public bank terms are volatile, so every offer keeps a source and update date and should eventually be replaced by a maintained backend/provider feed.
