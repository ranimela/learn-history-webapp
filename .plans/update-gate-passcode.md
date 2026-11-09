## Goal
Update the gate passcode to `jam` and replace the default passcode indicator with the schnitzel riddle hint.

## Files
- `app/gate/page.tsx`
- `app/api/auth/gate/route.ts`

## Change
- In `app/gate/page.tsx`: Replace `Default Passcode: history123` with `Hint: What does a civilized human being eat a schnitzel with?`
- In `app/api/auth/gate/route.ts`: Change fallback default `expectedPasscode` from `"history123"` to `"jam"`.

## Verify
- Visiting `/gate` displays: `Hint: What does a civilized human being eat a schnitzel with?`
- Submitting `jam` to `/api/auth/gate` succeeds with HTTP 200 and sets `quiz_auth` cookie.
- Submitting `history123` returns HTTP 401 with error `"Invalid passcode"`.
