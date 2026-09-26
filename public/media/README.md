# Temporary local housing media bridge

This is a frontend-only bridge until apartment photo URLs are served by the Go API.

The supplied housing contract says production UI should use backend-provided `cover_url` / `photos[].url`; `cover_storage_key` is not an image URL and archive `local_path` is not a server URL. This folder intentionally does **not** change that production contract.

For local development:

1. Copy the archive's **contents of its `media/` tree** into `public/media/`, preserving subdirectories.
2. Copy `processed/housing/media.jsonl` to `local-data/media.jsonl`.
3. Run `npm run media:manifest`.
4. Restart Vite.

The generator creates `src/data/localHousingMedia.generated.ts`, mapping each source apartment ID to local `/media/...` files in photo-position order.

When the Go API returns real photo URLs, those URLs always win and this local fallback becomes unused.
